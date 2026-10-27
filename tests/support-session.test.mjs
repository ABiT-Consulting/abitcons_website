import test from "node:test";
import assert from "node:assert/strict";
import { readStoredSupportUser, persistSupportUser, isCurrentSupportSession, isSupportSessionStorageEvent, createSupportSessionGuard, createSupportWorkspaceIdentityTracker, shouldEndSupportSession, isScopedSupportUser } from "../src/supportSession.js";

function storage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key) => entries.has(key) ? entries.get(key) : null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test("support and regular website sessions cannot overwrite one another", () => {
  const regular = { sessionToken: "general-token", email: "someone@example.com" };
  const support = { sessionToken: "support-token", login: "umar", clientCode: "CHT" };
  const store = storage({ "abit-auth-user": JSON.stringify(regular) });
  assert.equal(readStoredSupportUser(store), null);
  persistSupportUser(store, support);
  assert.equal(readStoredSupportUser(store).sessionToken, "support-token");
  assert.deepEqual(JSON.parse(store.getItem("abit-auth-user")), regular);
  persistSupportUser(store, null);
  assert.equal(readStoredSupportUser(store), null);
  assert.deepEqual(JSON.parse(store.getItem("abit-auth-user")), regular);
});

test("existing ABITask support sessions migrate without treating local website users as support", () => {
  const oldSupport = { sessionToken: "old-support-token", login: "umar", clientCode: "CHT" };
  const store = storage({ "abit-auth-user": JSON.stringify(oldSupport) });
  assert.deepEqual(readStoredSupportUser(store), oldSupport);
  assert.equal(store.getItem("abit-auth-user"), null);
  assert.equal(readStoredSupportUser(store).clientCode, "CHT");
});

test("invalid stored support JSON is cleared safely", () => {
  const store = storage({ "abit-support-auth-user": "{broken" });
  assert.equal(readStoredSupportUser(store), null);
  assert.equal(store.getItem("abit-support-auth-user"), null);
});

test("delayed support responses cannot replace or log out a newer company session", () => {
  const cht = { sessionToken: "cht-token", login: "umar", clientCode: "CHT" };
  const other = { sessionToken: "other-token", login: "other", clientCode: "OTHER" };
  const store = storage();
  persistSupportUser(store, cht);
  assert.equal(isCurrentSupportSession(cht, readStoredSupportUser(store)), true);
  persistSupportUser(store, other);
  assert.equal(isCurrentSupportSession(cht, readStoredSupportUser(store)), false);
  assert.equal(isCurrentSupportSession(other, readStoredSupportUser(store)), true);
  persistSupportUser(store, null);
  assert.equal(isCurrentSupportSession(other, readStoredSupportUser(store)), false);
});

test("only support account changes trigger the cross-tab workspace reset", () => {
  assert.equal(isSupportSessionStorageEvent("abit-support-auth-user"), true);
  assert.equal(isSupportSessionStorageEvent("abit-auth-user"), false);
  assert.equal(isSupportSessionStorageEvent(null), false);
});

test("outdated support sign-in responses are discarded after sign-out or cross-tab account changes", () => {
  const guard = createSupportSessionGuard();
  const pendingLogin = guard.capture();
  assert.equal(guard.isCurrent(pendingLogin), true);
  guard.invalidate(); // Another tab signed in, or user signed out.
  assert.equal(guard.isCurrent(pendingLogin), false);
  const replacementLogin = guard.capture();
  assert.equal(guard.isCurrent(replacementLogin), true);
  guard.invalidate(); // Sign-out and sign-in can happen before response arrives.
  guard.invalidate();
  assert.equal(guard.isCurrent(replacementLogin), false);
});

test("revoked or expired ABITask access must clear the visible support workspace", () => {
  assert.equal(shouldEndSupportSession(401), true);
  assert.equal(shouldEndSupportSession(403), true);
  assert.equal(shouldEndSupportSession(422), false);
  assert.equal(shouldEndSupportSession(502), false);
});

test("ABITask identities without a verified company cannot open a support workspace", () => {
  const unmapped = { sessionToken: "valid-looking-token", login: "umar" };
  const mapped = { sessionToken: "test-token", login: "umar", company: { clientCode: "CHT", name: "CHT" } };
  const store = storage({ "abit-support-auth-user": JSON.stringify(unmapped) });
  assert.equal(isScopedSupportUser(unmapped), false);
  assert.equal(readStoredSupportUser(store), null);
  assert.equal(store.getItem("abit-support-auth-user"), null);
  persistSupportUser(store, unmapped);
  assert.equal(store.getItem("abit-support-auth-user"), null);
  assert.equal(isScopedSupportUser(mapped), true);
  persistSupportUser(store, mapped);
  assert.deepEqual(readStoredSupportUser(store), mapped);
});

test("a response for a different company is rejected even if the token matches", () => {
  const cht = { sessionToken: "shared-token", clientCode: "CHT" };
  const other = { sessionToken: "shared-token", clientCode: "OTHER" };
  assert.equal(isCurrentSupportSession(cht, other), false);
  assert.equal(isCurrentSupportSession(cht, { ...cht, clientCode: "cht" }), true);
});

test("a changed ABITask account clears previously rendered company data before its next fetch", () => {
  const tracker = createSupportWorkspaceIdentityTracker();
  const cht = { sessionToken: "cht-token", clientCode: "CHT" };
  const other = { sessionToken: "other-token", clientCode: "OTHER" };
  assert.equal(tracker.hasChanged(cht), true); // First account loaded.
  assert.equal(tracker.hasChanged({ ...cht }), false); // Background refresh is safe.
  assert.equal(tracker.hasChanged(other), true); // Clear CHT data immediately.
  assert.equal(tracker.hasChanged(other), false);
  assert.equal(tracker.hasChanged({ ...other, sessionToken: "renewed" }), true);
  tracker.reset(); // Sign-out wipes the scope.
  assert.equal(tracker.hasChanged(cht), true);
});
