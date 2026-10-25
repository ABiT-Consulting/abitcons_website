import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("support login retains ERPNext password verification, not support flag bypass", () => {
  const source = read("../server/erp-support.js");
  assert.match(source, /const response = await fetch\(baseUrl \+ "\/api\/method\/login"/);
  assert.match(source, /const mapped = await validateMappedUser\(erpUser\)/);
  assert.match(source, /checkbox does not set a password/);
});
test("password recovery URL uses configured ERPNext service, not a hardcoded password", () => {
  const source = read("../server/erp-support.js");
  assert.match(source, /recoveryUrl:\s*baseUrl \+ "\/login#forgot"/);
  assert.doesNotMatch(source, /password\s*:\s*["'](?:Administrator|admin123)["']/);
});
test("ERP recovery is available even without username entered", () => {
  const source = read("../server/index.js");
  const section = source.split("const handleSupportForgotPassword = async")[1].split("const serveStatic =")[0];
  assert.ok(section.indexOf("if (erpSupport.enabled)") < section.indexOf("if (!login)"));
  assert.match(section, /recoveryUrl: erpSupport.recoveryUrl/);
});
test("UI gives a safe external password reset link without storing new passwords", () => {
  const source = read("../src/main.js");
  assert.match(source, /document.createElement\("a"\)/);
  assert.match(source, /link.rel = "noopener noreferrer"/);
  assert.match(source, /target.protocol === "https:"/);
});
