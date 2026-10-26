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
    assert.equal(deployed, source, `dist/api/${file} must match public/api/${file}; run npm run build`);
  }
});
