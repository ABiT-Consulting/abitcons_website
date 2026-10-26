// Use only the identity supplied by ABITask; never trust a company code from the URL.
export function getSupportClientCode(user) {
  const explicit = user?.clientCode ?? user?.company?.clientCode ?? user?.company?.code;
  const candidate = String(explicit || "").trim();
  if (/^[a-z0-9][a-z0-9_-]{1,31}$/i.test(candidate)) return candidate;

  // Some bridge versions return the short client code as company.name only.
  const companyName = String(user?.company?.name || "").trim();
  return /^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(companyName) ? companyName : "";
}

export const supportWorkspaceHash = (user) => {
  const code = getSupportClientCode(user);
  return code ? "#support-portal/" + encodeURIComponent(code) : "#support-portal";
};

export function getRequestedSupportClientCode(hash) {
  if (!hash.startsWith("#support-portal/")) return "";
  try {
    return decodeURIComponent(hash.slice("#support-portal/".length)).trim();
  } catch {
    return "";
  }
}
