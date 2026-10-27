// Use only the identity supplied by ABITask; never trust a company code from the URL.
export function getSupportClientCode(user) {
  // ABITask may provide the tenant code in more than one identity field.
  // Conflicting or malformed codes are never safe to use for a workspace.
  const declared = [user?.clientCode, user?.companyCode,
    user?.company?.clientCode, user?.company?.code]
    .filter((value) => value !== undefined && value !== null);
  if (declared.length) {
    const codes = declared.map((value) => typeof value === "string" ? value.trim() : "");
    if (codes.some((code) => !/^[a-z0-9][a-z0-9_-]{1,31}$/i.test(code)) ||
        codes.some((code) => code.toLowerCase() !== codes[0].toLowerCase())) return "";
    return codes[0];
  }

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
