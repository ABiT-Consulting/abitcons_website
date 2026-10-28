import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("Dev-02 cPanel fallback fails closed without authorized environment credentials", () => {
  const env = { ...process.env };
  for (const name of ["CPANEL_HOST", "CPANEL_USER", "CPANEL_TOKEN", "CPANEL_REPO_ROOT"]) {
    delete env[name];
  }
  const result = spawnSync(process.execPath, ["scripts/deploy_cpanel_dev02.mjs"], {
    env, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No deployment attempted/);
  assert.doesNotMatch(result.stdout, /deployment queued|publishing/i);
});

test("Dev-02 fallback is pinned to the verified website repository and HTTPS", () => {
  const source = readFileSync(new URL("../scripts/deploy_cpanel_dev02.mjs", import.meta.url), "utf8");
  assert.match(source, /ABiT-Consulting\/abitcons_website/);
  assert.match(source, /expected clean, pushed ABiT website main/);
  assert.match(source, /https:\/\//);
  assert.match(source, /VersionControlDeployment\/create/);
  assert.match(source, /verify_support_bridge\.mjs/);
  assert.doesNotMatch(source, /CPANEL_TOKEN\s*=\s*["']/);
});


test("Azure DevOps cPanel deploy fails closed if secure pipeline variables are absent", () => {
  const env = { ...process.env };
  for (const name of ["CPANEL_HOST", "CPANEL_USER", "CPANEL_TOKEN", "CPANEL_REPO_ROOT"]) {
    delete env[name];
  }
  const result = spawnSync(process.execPath, ["scripts/deploy_cpanel_azure.mjs"], {
    env, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Deployment blocked: configure Azure DevOps pipeline variables/);
  assert.doesNotMatch(result.stdout, /deployment accepted|production deployment/i);
});

test("Azure DevOps cPanel deploy rejects non-website pipeline and branch before any network call", () => {
  const env = {
    ...process.env,
    CPANEL_HOST: "example.com",
    CPANEL_USER: "test",
    CPANEL_TOKEN: "not-real",
    CPANEL_REPO_ROOT: "/home/test/abitcons_website",
    BUILD_DEFINITIONNAME: "WRONG_PIPELINE",
    BUILD_REPOSITORY_NAME: "ABiT-Consulting/abitcons_website",
    BUILD_SOURCEBRANCH: "refs/heads/untrusted",
    BUILD_SOURCEVERSION: "a".repeat(40),
  };
  const result = spawnSync(process.execPath, ["scripts/deploy_cpanel_azure.mjs"], {
    env, encoding: "utf8", timeout: 10000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing cPanel deployment outside/);
  assert.doesNotMatch(result.stdout, /Deploying verified|deployment accepted/i);
});

test("Azure DevOps runs tests, validates committed cPanel payload and deploys only main", () => {
  const yaml = readFileSync(new URL("../azure-pipelines.yml", import.meta.url), "utf8");
  const deploy = readFileSync(new URL("../scripts/deploy_cpanel_azure.mjs", import.meta.url), "utf8");
  const github = readFileSync(new URL("../.github/workflows/cpanel-deploy.yml", import.meta.url), "utf8");
  assert.match(yaml, /vmImage:\s*ubuntu-latest/);
  assert.match(yaml, /npm ci[\s\S]*npm test[\s\S]*npm run build/);
  assert.match(yaml, /git diff --ignore-space-at-eol --exit-code -- dist/);
  assert.match(yaml, /DeployProduction[\s\S]*refs\/heads\/main/);
  assert.match(yaml, /deploy_cpanel_azure\.mjs/);
  assert.match(yaml, /CPANEL_TOKEN:\s*\$\(CPANEL_TOKEN\)/);
  assert.match(deploy, /VersionControl\/retrieve/);
  assert.match(deploy, /VersionControl\/update/);
  assert.match(deploy, /VersionControlDeployment\/create/);
  assert.match(deploy, /verify_support_bridge\.mjs/);
  assert.match(deploy, /BUILD_SOURCEVERSION/);
  assert.match(github, /workflow_dispatch:\s*\{\}/);
  assert.doesNotMatch(github.split("jobs:")[0], /^\s*push:\s*$/m);
  assert.doesNotMatch(deploy, /CPANEL_TOKEN\s*=\s*["']/);
});


test("cPanel repository discovery identifies exactly the authorized website source", async () => {
  const { selectWebsiteCpanelRepository: select } =
    await import("../scripts/cpanel_repo_identity.mjs");
  const website = {
    repository_root: "/home1/abitcons/git/abitcons_website",
    source_repository: { url: "https://github.com/ABiT-Consulting/abitcons_website.git" },
    branch: "main",
    deployable: 1,
    type: "git",
  };
  const unrelated = {
    ...website,
    repository_root: "/home1/abitcons/git/other_site",
    source_repository: { url: "https://github.com/ABiT-Consulting/another_website.git" },
  };
  assert.equal(select([unrelated, website]), website.repository_root);
  assert.equal(select([website, unrelated], website.repository_root), website.repository_root);
  assert.equal(
    select([{ ...website, source_repository: { url: "git@github.com:ABiT-Consulting/abitcons_website.git" } }]),
    website.repository_root,
  );
  assert.throws(() => select([unrelated]), /exactly one verified/);
  assert.throws(() => select([website, { ...website, repository_root: "/home1/abitcons/git/website_copy" }]), /exactly one verified/);
  assert.throws(() => select([website], "/home1/abitcons/git/other_site"), /exactly one verified/);
  assert.throws(() => select([{ ...website, branch: "master" }]), /not on main/);
  assert.throws(() => select([{ ...website, deployable: 0 }]), /not deployable/);
  assert.throws(() => select([{ ...website, repository_root: "/home1/otheruser/git/../public_html" }]), /Untrusted/);
  assert.throws(() => select(null), /unexpected Git repository list/);
});

test("Azure deployment discovers cPanel repository safely, without a hardcoded path", () => {
  const script = readFileSync(new URL("../scripts/deploy_cpanel_azure.mjs", import.meta.url), "utf8");
  assert.match(script, /selectWebsiteCpanelRepository\(registeredRepos, rootHint\)/);
  assert.match(script, /VersionControl\/retrieve/);
  assert.match(script, /VersionControlDeployment\/retrieve/);
  assert.match(script, /updated\.last_update\.identifier !== actualCommit/);
  assert.match(script, /const required = \["CPANEL_HOST", "CPANEL_USER", "CPANEL_TOKEN"\]/);
  assert.doesNotMatch(script, /CPANEL_TOKEN\s*=\s*["']/);
});
