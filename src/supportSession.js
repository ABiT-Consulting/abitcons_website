import { getSupportClientCode } from "./supportWorkspace.js";

const supportSessionKey = "abit-support-auth-user";
const legacySessionKey = "abit-auth-user";

function readSession(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function readStoredSupportUser(storage) {
  const current = readSession(storage, supportSessionKey);
  if (current?.sessionToken) return current;

  // Existing deployments used the general website login key. Migrate only
  // sessions identifiable as support/ABITask identities, never local accounts.
  const legacy = readSession(storage, legacySessionKey);
  if (legacy?.sessionToken &&
      (legacy.provider === "Support" || legacy.provider === "ABITask" || getSupportClientCode(legacy))) {
    storage.setItem(supportSessionKey, JSON.stringify(legacy));
    storage.removeItem(legacySessionKey);
    return legacy;
  }
  return null;
}

export function persistSupportUser(storage, user) {
  if (user?.sessionToken) {
    storage.setItem(supportSessionKey, JSON.stringify(user));
  } else {
    storage.removeItem(supportSessionKey);
  }
}

// Ignore delayed network results from an older support sign-in after a user
// signs out or changes accounts; never render the previous client workspace.
export function isSupportSessionStorageEvent(key) {
  return key === supportSessionKey;
}

export function isCurrentSupportSession(expected, current) {
  return Boolean(expected?.sessionToken && expected.sessionToken === current?.sessionToken);
}
