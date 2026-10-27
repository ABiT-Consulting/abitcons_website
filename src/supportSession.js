import { getSupportClientCode } from "./supportWorkspace.js";

const supportSessionKey = "abit-support-auth-user";
const legacySessionKey = "abit-auth-user";

export function isScopedSupportUser(user) {
  return Boolean(typeof user?.sessionToken === "string" && user.sessionToken && getSupportClientCode(user));
}

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
  if (isScopedSupportUser(current)) return current;
  if (current) storage.removeItem(supportSessionKey);

  // Existing deployments used the general website login key. Migrate only
  // sessions identifiable as support/ABITask identities, never local accounts.
  const legacy = readSession(storage, legacySessionKey);
  if (isScopedSupportUser(legacy)) {
    storage.setItem(supportSessionKey, JSON.stringify(legacy));
    storage.removeItem(legacySessionKey);
    return legacy;
  }
  return null;
}

export function persistSupportUser(storage, user) {
  if (isScopedSupportUser(user)) {
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

export function shouldEndSupportSession(status) {
  return status === 401 || status === 403;
}
export function isCurrentSupportSession(expected, current) {
  return Boolean(isScopedSupportUser(expected) && isScopedSupportUser(current) &&
    expected.sessionToken === current.sessionToken &&
    getSupportClientCode(expected).toLowerCase() === getSupportClientCode(current).toLowerCase());
}

// Track a session's lifetime, including sign-out followed by sign-in, so late
// login responses cannot silently restore an older company's workspace.
export function createSupportSessionGuard() {
  let revision = 0;
  return {
    capture: () => revision,
    invalidate: () => { revision += 1; },
    isCurrent: (captured) => captured === revision,
  };
}
