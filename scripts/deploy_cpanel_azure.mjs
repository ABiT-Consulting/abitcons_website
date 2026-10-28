// Azure DevOps -> cPanel Git deployment for ABITCONS_WEBSITE.
// Only deploys a verified main build of ABiT-Consulting/abitcons_website.
// cPanel credentials are injected by Azure DevOps; never store or log them.
import { execFileSync, spawnSync } from "node:child_process";
import { selectWebsiteCpanelRepository } from "./cpanel_repo_identity.mjs";

const required = ["CPANEL_HOST", "CPANEL_USER", "CPANEL_TOKEN"];
const unset = (value) => !value?.trim() || /^\$\([A-Za-z_][A-Za-z0-9_.-]*\)$/.test(value.trim());
const missing = required.filter((name) => unset(process.env[name]));
if (missing.length) {
  console.error("Deployment blocked: configure Azure DevOps pipeline variables " +
    missing.join(", ") + ". No deployment attempted.");
  process.exit(2);
}

const expectedRepository = "ABiT-Consulting/abitcons_website";
const sourceVersion = process.env.BUILD_SOURCEVERSION || "";
if (process.env.BUILD_DEFINITIONNAME !== "ABITCONS_WEBSITE" ||
    process.env.BUILD_REPOSITORY_NAME !== expectedRepository ||
    process.env.BUILD_SOURCEBRANCH !== "refs/heads/main" ||
    !/^[0-9a-f]{40}$/i.test(sourceVersion)) {
  throw new Error("Refusing cPanel deployment outside the ABITCONS_WEBSITE main release pipeline.");
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const actualCommit = git("rev-parse", "HEAD");
const origin = git("remote", "get-url", "origin");
if (actualCommit !== sourceVersion ||
    !/github\.com[:/]ABiT-Consulting\/abitcons_website(?:\.git)?\/?$/i.test(origin) ||
    git("status", "--porcelain")) {
  throw new Error("Refusing deployment of an unverified or dirty website checkout.");
}

const host = process.env.CPANEL_HOST.trim();
const port = unset(process.env.CPANEL_PORT) ? "2083" : process.env.CPANEL_PORT.trim();
const user = process.env.CPANEL_USER.trim();
const token = process.env.CPANEL_TOKEN.trim();
const rootHint = unset(process.env.CPANEL_REPO_ROOT) ? "" : process.env.CPANEL_REPO_ROOT.trim();
if (!/^[a-z0-9.-]+$/i.test(host) || !/^\d{2,5}$/.test(port) ||
    (rootHint && (!rootHint.startsWith("/") || rootHint.split("/").includes("..")))) {
  throw new Error("Invalid cPanel host, port, or optional repository root.");
}
const base = "https://" + host + ":" + port + "/execute/";
const auth = "cpanel " + user + ":" + token;

async function api(route, params = {}) {
  const url = new URL(route, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: auth, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("cPanel " + route + " HTTP " + response.status);
  const body = await response.json();
  const result = body?.result ?? body;
  if (Number(result?.status) !== 1) {
    // cPanel error bodies may contain user-specific paths or tokens. Never echo them.
    throw new Error("cPanel " + route + " returned unsuccessful status.");
  }
  return result.data;
}
const value = (data) => Array.isArray(data) ? data[0] : data;

// VersionControl/retrieve returns all registered repositories, not one record.
// Select only a unique Git repo explicitly linked to THIS website source.
const registeredRepos = await api("VersionControl/retrieve");
const root = selectWebsiteCpanelRepository(registeredRepos, rootHint);
console.log("Validated cPanel website Git binding; updating main to " + actualCommit.slice(0, 12) + ".");

const updated = value(await api("VersionControl/update", {
  repository_root: root, branch: "main",
}));
if (updated && Number(updated.deployable) === 0) {
  throw new Error("cPanel Git repository is not deployable after update.");
}
if (updated?.last_update?.identifier &&
    updated.last_update.identifier !== actualCommit) {
  throw new Error("cPanel Git update did not reach the verified main commit.");
}

const created = value(await api("VersionControlDeployment/create", { repository_root: root }));
const id = created?.deploy_id;
if (id === undefined || id === null || String(id) === "") {
  throw new Error("cPanel did not return a deployment ID.");
}
console.log("cPanel deployment accepted. Verifying completion.");

let verified = false;
for (let attempt = 0; attempt < 60; attempt++) {
  const data = await api("VersionControlDeployment/retrieve");
  const entries = Array.isArray(data) ? data : (data ? [data] : []);
  const entry = entries.find((candidate) =>
    String(candidate?.deploy_id) === String(id) && candidate?.repository_root === root);
  if (entry?.timestamps?.failed || entry?.timestamps?.canceled) {
    throw new Error("cPanel Git deployment failed or was cancelled.");
  }
  if (entry?.timestamps?.succeeded) {
    const deployedCommit = String(entry.repository_state?.identifier || "");
    if (!/^[0-9a-f]{7,40}$/i.test(deployedCommit) ||
        !actualCommit.startsWith(deployedCommit)) {
      throw new Error("cPanel deployment commit does not match the verified release.");
    }
    verified = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
if (!verified) throw new Error("Timed out verifying cPanel Git deployment.");

console.log("cPanel confirmed commit " + actualCommit.slice(0, 12) +
  "; checking the public website support bridge.");
const smoke = spawnSync(process.execPath, [
  "scripts/verify_support_bridge.mjs", "https://www.abitcons.com",
], { stdio: "inherit", windowsHide: true, timeout: 120000 });
if (smoke.status !== 0) throw new Error("Live support bridge smoke test failed.");
console.log("Production deployment and read-only live smoke test passed.");
