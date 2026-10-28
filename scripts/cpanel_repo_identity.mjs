// Validate the one intended cPanel-managed Git repository before any mutation.
// cPanel VersionControl/retrieve returns an array of account repositories.
// Never select the first record or trust an unverified path.
const websiteRemote =
  /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:|git:\/\/github\.com\/)ABiT-Consulting\/abitcons_website(?:\.git)?\/?$/i;

export function selectWebsiteCpanelRepository(repositories, requestedRoot = "") {
  if (!Array.isArray(repositories)) {
    throw new Error("cPanel returned an unexpected Git repository list; deployment aborted.");
  }
  const rootFilter = requestedRoot?.trim() || "";
  if (rootFilter && (!rootFilter.startsWith("/") || rootFilter.split("/").includes(".."))) {
    throw new Error("Invalid configured cPanel repository root.");
  }
  const matches = repositories.filter((record) => {
    const source = record?.source_repository?.url ?? record?.remote_url;
    return typeof source === "string" &&
      websiteRemote.test(source.trim()) &&
      (!rootFilter || record.repository_root === rootFilter);
  });
  if (matches.length !== 1) {
    throw new Error("Expected exactly one verified ABITCONS Git repository; no deployment attempted.");
  }
  const repo = matches[0];
  if (typeof repo.repository_root !== "string" ||
      !/^\/home\d*\/[^/]+\/[^/]/.test(repo.repository_root) ||
      repo.repository_root.split("/").includes("..") ||
      /[\\*"'<>&@{}\[\]|;?=:%#]/.test(repo.repository_root)) {
    throw new Error("Untrusted cPanel repository directory; deployment aborted.");
  }
  if (repo.type && repo.type !== "git") {
    throw new Error("The verified cPanel repository is not a Git repository.");
  }
  if (repo.branch !== "main") {
    throw new Error("The verified cPanel website repository is not on main.");
  }
  if (Number(repo.deployable) !== 1) {
    throw new Error("The verified cPanel website repository is not deployable.");
  }
  return repo.repository_root;
}
