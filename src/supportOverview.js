import { getSupportClientCode } from "./supportWorkspace.js";

// Never render a partial or cross-client ABITask response as a synced workspace.
// ABITask must enforce client isolation on the server; this is a second
// boundary for accidentally mixed tenant records returned by the bridge.
function matchesDeclaredClient(record, client) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const claimed = record.clientCode ?? record.companyCode ??
    record.company?.clientCode ?? record.company?.code;
  return claimed == null ||
    (typeof claimed === "string" && claimed.trim().toLowerCase() === client.toLowerCase());
}

export function isValidSupportOverview(overview, user) {
  const currentClient = getSupportClientCode(user);
  if (!currentClient || !overview || typeof overview !== "object" || Array.isArray(overview) ||
      !overview.summary || typeof overview.summary !== "object" || Array.isArray(overview.summary) ||
      !Array.isArray(overview.tickets) || !Array.isArray(overview.projects) ||
      !Array.isArray(overview.tasks)) {
    return false;
  }

  // Older ABITask contracts omit the client code. Check it whenever present,
  // including on individual tickets, projects, and tasks, so a mixed response
  // cannot leak another company's data into the current workspace.
  return [overview, ...overview.tickets, ...overview.projects, ...overview.tasks]
    .every((record) => matchesDeclaredClient(record, currentClient));
}
