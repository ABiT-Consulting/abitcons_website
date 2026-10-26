import test from "node:test";
import assert from "node:assert/strict";
import {
  getSupportClientCode, getRequestedSupportClientCode, supportWorkspaceHash,
} from "../src/supportWorkspace.js";

test("ABITask company code produces canonical CHT workspace route", () => {
  assert.equal(getSupportClientCode({clientCode:"CHT",company:{name:"Cloud Taktiks"}}),"CHT");
  assert.equal(supportWorkspaceHash({company:{clientCode:"CHT",name:"Cloud Taktiks"}}),"#support-portal/CHT");
  assert.equal(supportWorkspaceHash({company:{name:"CHT"}}),"#support-portal/CHT");
});
test("never derive client scope from a user-controllable URL", () => {
  assert.equal(supportWorkspaceHash({}), "#support-portal");
  assert.equal(getSupportClientCode({company:{name:"Acme Corporation"}}), "");
  assert.equal(getSupportClientCode({clientCode:"../OTHER",company:{name:"Client"}}),"");
  assert.equal(getRequestedSupportClientCode("#support-portal/%xx"),"");
  assert.equal(getRequestedSupportClientCode("#support-portal/OTHER"),"OTHER");
});
