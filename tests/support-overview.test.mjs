import test from "node:test";
import assert from "node:assert/strict";
import { isValidSupportOverview } from "../src/supportOverview.js";

const user = { login: "umar", sessionToken: "test-session", clientCode: "CHT" };
const valid = () => ({ summary: {}, tickets: [], projects: [{ title: "CHT project" }], tasks: [], clientCode: "CHT" });

test("a complete ABITask overview is accepted for the signed-in company", () => {
  assert.equal(isValidSupportOverview(valid(), user), true);
  assert.equal(isValidSupportOverview({ ...valid(), clientCode: "cht" }, user), true);
  const legacy = valid();
  delete legacy.clientCode;
  assert.equal(isValidSupportOverview(legacy, user), true);
});

test("a partial response must not pretend that ERP projects and tasks are empty", () => {
  for (const overview of [{}, { summary: {} }, { ...valid(), tasks: null },
    { ...valid(), projects: null }, { ...valid(), tickets: {} },
    { ...valid(), summary: [] }, null, []]) {
    assert.equal(isValidSupportOverview(overview, user), false);
  }
});

test("an overview declaring another company cannot be rendered in CHT workspace", () => {
  assert.equal(isValidSupportOverview({ ...valid(), clientCode: "OTHER" }, user), false);
  assert.equal(isValidSupportOverview({ ...valid(), clientCode: "" }, user), false);
  assert.equal(isValidSupportOverview({ ...valid(), clientCode: null, company: { code: "OTHER" } }, user), false);
  assert.equal(isValidSupportOverview(valid(), { ...user, clientCode: "OTHER" }), false);
  assert.equal(isValidSupportOverview(valid(), { login: "unknown", sessionToken: "token" }), false);
});
