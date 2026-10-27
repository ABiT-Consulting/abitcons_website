import test from "node:test";
import assert from "node:assert/strict";
import { readStoredSupportUser, persistSupportUser, isCurrentSupportSession } from "../src/supportSession.js";

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
