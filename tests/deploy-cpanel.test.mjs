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
