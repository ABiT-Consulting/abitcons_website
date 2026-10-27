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

test("conflicting company-code aliases cannot mask a cross-company record", () => {
  const contradiction = { clientCode: "CHT", companyCode: "OTHER", company: { code: "CHT" } };
  assert.equal(isValidSupportOverview({ ...valid(), ...contradiction }, user), false);
  assert.equal(isValidSupportOverview({ ...valid(), clientCode: "CHT", company: { clientCode: "OTHER" } }, user), false);
  for (const collection of ["tickets", "projects", "tasks"]) {
    assert.equal(isValidSupportOverview({ ...valid(), [collection]: [contradiction] }, user), false,
      `${collection} must reject contradictory company codes`);
    assert.equal(isValidSupportOverview({ ...valid(), [collection]: [{
      clientCode: "CHT", company: { clientCode: "CHT", code: "OTHER" },
    }] }, user), false, `${collection} must check nested company aliases`);
  }
  assert.equal(isValidSupportOverview({ ...valid(), clientCode: "CHT", companyCode: "cht",
    company: { code: "CHT", clientCode: "cht" } }, user), true);
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
test("summary identity must match the signed-in ABITask client", () => {
  const summary = { openTickets: 3, clientCode: "CHT", companyCode: "cht" };
  assert.equal(isValidSupportOverview({ ...valid(), summary }, user), true);
  assert.equal(isValidSupportOverview({ ...valid(), summary: { ...summary, companyCode: "OTHER" } }, user), false);
  assert.equal(isValidSupportOverview({ ...valid(), summary: { company: { code: "OTHER" } } }, user), false);
  assert.equal(isValidSupportOverview({ ...valid(), summary: { clientCode: "" } }, user), false);
});
