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

test("a mixed-company ticket, project, or ERP task blocks the entire workspace", () => {
  for (const collection of ["tickets", "projects", "tasks"]) {
    for (const tenantField of [
      { clientCode: "OTHER" },
      { companyCode: "OTHER" },
      { company: { code: "OTHER" } },
      { company: { clientCode: "OTHER" } },
    ]) {
      assert.equal(isValidSupportOverview({
        ...valid(),
        [collection]: [{ title: "Cross-client record", ...tenantField }],
      }, user), false, `${collection} must not include another company's records`);
    }
  }
});

test("legacy records without client metadata still render, but malformed records do not", () => {
  assert.equal(isValidSupportOverview({
    ...valid(),
    tickets: [{ title: "Ticket" }],
    tasks: [{ title: "Task", companyCode: "cht" }],
    projects: [{ title: "Project", clientCode: "CHT" }],
  }, user), true);
  for (const collection of ["tickets", "projects", "tasks"]) {
    assert.equal(isValidSupportOverview({ ...valid(), [collection]: [null] }, user), false);
    assert.equal(isValidSupportOverview({ ...valid(), [collection]: ["untrusted"] }, user), false);
  }
});
