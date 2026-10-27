// Dev-02 fallback when GitHub-hosted Actions cannot start. Requires cPanel
// credentials injected as environment variables; never stores or prints them.
import { execFileSync, spawnSync } from "node:child_process";

const repository = "ABiT-Consulting/abitcons_website";
const vars = ["CPANEL_HOST", "CPANEL_USER", "CPANEL_TOKEN", "CPANEL_REPO_ROOT"];
const missing = vars.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Missing Dev-02 environment configuration: ${missing.join(", ")}. No deployment attempted.`);
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const localBranch = git("branch", "--show-current");
const targetBranch = process.env.CPANEL_BRANCH?.trim() || "main";
const remote = git("remote", "get-url", "origin");
const localSha = git("rev-parse", "HEAD");
const pushedSha = git("rev-parse", "origin/" + targetBranch);
const remoteSha = git("ls-remote", "origin", "refs/heads/" + targetBranch).split(/\s+/)[0];
if (targetBranch !== "main" || localBranch !== targetBranch ||
    !/github\.com[:/]ABiT-Consulting\/abitcons_website(?:\.git)?$/i.test(remote) ||
    localSha !== pushedSha || localSha !== remoteSha || git("status", "--porcelain")) {
  throw new Error("Refusing deploy: expected clean, pushed ABiT website main on Dev-02.");
}

const hostname = process.env.CPANEL_HOST.trim();
const port = process.env.CPANEL_PORT?.trim() || "2083";
if (!/^[a-z0-9.-]+$/i.test(hostname) || !/^\d{2,5}$/.test(port)) {
  throw new Error("Invalid cPanel endpoint configuration.");
}
const base = `https://${hostname}:${port}/execute/`;
const auth = "cpanel " + process.env.CPANEL_USER.trim() + ":" + process.env.CPANEL_TOKEN.trim();
const root = process.env.CPANEL_REPO_ROOT.trim();
if (!root.startsWith("/") || !root.toLowerCase().includes("abitcons_website")) {
  throw new Error("Refusing deployment: cPanel repository root does not identify the website repository.");
}

async function api(route, params = {}) {
  const url = new URL(route, base);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: { Authorization: auth, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`cPanel ${route} HTTP ${response.status}`);
  const json = await response.json();
  const result = json.result ?? json;
  if (Number(result.status) !== 1) {
    const reason = result.metadata?.reason || result.errors?.[0] || "API returned unsuccessful status";
    throw new Error(`cPanel ${route}: ${String(reason).slice(0, 250)}`);
  }
  return result.data;
}

const record = await api("VersionControl/retrieve", { repository_root: root });
const matching = Array.isArray(record) ? record[0] : record;
const upstream = [
  matching?.clone_url, matching?.repository_url, matching?.remote_url,
  matching?.url, matching?.source_repo,
].find((value) => typeof value === "string" && value.length);
if (!upstream || !/github\.com[:/]ABiT-Consulting\/abitcons_website(?:\.git)?$/i.test(upstream)) {
  throw new Error("cPanel repo binding could not be verified. No deployment attempted.");
}

console.log(`Validated website cPanel binding; publishing ${localSha.slice(0, 12)} on ${targetBranch}.`);
const updated = await api("VersionControl/update", {
  repository_root: root, branch: targetBranch,
});
if (updated && Number(updated.deployable) === 0) {
  throw new Error("cPanel repository is not deployable: " + (updated.deployable_reason || "unknown reason"));
}

const created = await api("VersionControlDeployment/create", { repository_root: root });
const deployId = created?.deploy_id;
if (!deployId) throw new Error("cPanel returned no deployment ID.");
console.log("cPanel deployment queued; checking completion.");

let deployed = false;
for (let i = 0; i < 60; i++) {
  const data = await api("VersionControlDeployment/retrieve");
  const entries = Array.isArray(data) ? data : [data];
  const entry = entries.find((value) => String(value?.deploy_id) === String(deployId));
  if (entry?.timestamps?.succeeded) {
    const deployedSha = entry.repository_state?.identifier || "";
    if (deployedSha && !localSha.startsWith(deployedSha) && !deployedSha.startsWith(localSha)) {
      throw new Error("Deployed commit does not match the intended website commit.");
    }
    deployed = true;
    break;
  }
  if (entry?.timestamps?.failed || entry?.timestamps?.canceled) {
    throw new Error("cPanel reports deployment failure. Check hosting deployment logs.");
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
if (!deployed) throw new Error("Timed out confirming cPanel deployment.");
console.log("cPanel deployment succeeded. Running read-only production smoke test.");
const checked = spawnSync(process.execPath, ["scripts/verify_support_bridge.mjs", "https://www.abitcons.com"], {
  stdio: "inherit", windowsHide: true,
});
if (checked.status !== 0) throw new Error("Production support bridge smoke test failed.");
console.log("ABITCONS.COM deployment and smoke test confirmed.");
