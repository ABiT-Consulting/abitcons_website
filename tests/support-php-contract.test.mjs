import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const phpEndpoints = new Map([
  ["signin.php", "/api/signin"],
  ["support-overview.php", "/api/support/overview"],
  ["support-ticket.php", "/api/support/tickets"],
  ["support-forgot-password.php", "/api/support/forgot-password"],
]);

test("production PHP endpoints use the ABITask bridge, not local-account authentication", () => {
  for (const [file, upstream] of phpEndpoints) {
    const source = readFileSync(new URL(`../public/api/${file}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`api_bridge_proxy\\('${upstream.replaceAll("/", "\\/")}'`));
    assert.doesNotMatch(source, /api_signin\s*\(|api_support_overview\s*\(/);
  }
});

test("production dist contains exactly the PHP support bridge code that was tested", () => {
  for (const file of ["_bootstrap.php", ...phpEndpoints.keys()]) {
    const source = readFileSync(new URL(`../public/api/${file}`, import.meta.url), "utf8");
    const deployed = readFileSync(new URL(`../dist/api/${file}`, import.meta.url), "utf8");
    assert.equal(deployed.replaceAll("\r\n", "\n"), source.replaceAll("\r\n", "\n"), `dist/api/${file} must match public/api/${file}; run npm run build`);
  }
});

test("website deployment cannot mutate unrelated cPanel domains", () => {
  const workflow = readFileSync(new URL("../.github/workflows/cpanel-deploy.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /SubDomain|changedocroot|sbodesk|sns-site/i);
  assert.ok(workflow.includes("VersionControlDeployment/create"));
  assert.ok(workflow.includes("verify_support_bridge.mjs"));
});

test("PHP support proxy validates JSON shapes and prevents unscoped task creation", () => {
  const php = readFileSync(new URL("../public/api/_bootstrap.php", import.meta.url), "utf8");
  assert.match(php, /\$inputObject = json_decode\(\$rawBody\)/);
  assert.match(php, /!\(\$inputObject instanceof stdClass\)/);
  assert.match(php, /Username and password are required/);
  assert.match(php, /Ticket subject and details are required/);
  assert.match(php, /Never forward client-supplied company or ERP project overrides/);
  assert.doesNotMatch(php.slice(php.indexOf("function api_bridge_proxy")), /\$input\['(?:clientCode|company|project)'\]/);
  assert.match(php, /!is_object\(json_decode\(\$responseBody\)\)/);
});

test("PHP support bridge rejects insecure upstream URLs", () => {
  const php = readFileSync(new URL("../public/api/_bootstrap.php", import.meta.url), "utf8");
  const section = php.slice(php.indexOf("function api_task_portal_bridge_url"), php.indexOf("function api_bridge_proxy"));
  assert.match(section, /parse_url\(\$base\)/);
  assert.match(section, /\$scheme !== 'https'/);
  assert.match(section, /localhost/);
  assert.match(section, /Support portal bridge is not configured/);
});
