import { getSupportClientCode } from "./supportWorkspace.js";

// Never treat a partial or cross-client ABITask response as a successfully synced workspace.
// Client isolation must also be enforced by the authenticated ABITask backend.
export function isValidSupportOverview(overview, user) {
  const currentClient = getSupportClientCode(user);
  if (!currentClient || !overview || typeof overview !== "object" || Array.isArray(overview) ||
      !overview.summary || typeof overview.summary !== "object" || Array.isArray(overview.summary) ||
      !Array.isArray(overview.tickets) || !Array.isArray(overview.projects) ||
      !Array.isArray(overview.tasks)) {
    return false;
  }

  // Older bridge contracts omit the client code in overview responses. When present,
  // it must agree with the authenticated session (never the URL hash).
  const claimedClient = overview.clientCode ?? overview.company?.clientCode ?? overview.company?.code;
  return claimedClient == null ||
    (typeof claimedClient === "string" &&
     claimedClient.trim().toLowerCase() === currentClient.toLowerCase());
}
