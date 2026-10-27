// Public, credential-free production smoke test for the deployed ABITask support bridge.
// Uses deliberately invalid credentials. Never supply a real user password to this script.
const base = process.argv[2] || "https://www.abitcons.com";
const origin = new URL(base);
if (origin.protocol !== "https:" &&
    !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
  throw new Error("Use an HTTPS site URL (or localhost for testing).");
}

async function request(path, options) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...options,
  });
  const body = await response.text();
  let data = null;
  try { data = JSON.parse(body); } catch { /* reported below */ }
  return { response, body, data };
}

function verify(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

try {
  const home = await request("/");
  verify(home.response.status === 200 && home.body.includes("data-support-login-form"),
    "Website serves the support login form");

  const health = await request("/api/health.php");
  verify(health.response.status === 200 && health.data?.ok === true,
    "PHP API health responds successfully");

  const login = await request("/api/signin.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: "__abit_support_bridge_smoke_nonexistent__",
      password: "invalid-smoke-password",
    }),
  });
  verify(
    login.response.status === 401 && typeof login.data?.error === "string" &&
    !/valid email address|local account mode/i.test(login.data.error),
    `Support login uses ABITask rather than local email mode (HTTP ${login.response.status}; ${String(login.data?.error || "unexpected response").slice(0, 150)})`,
  );

  const overview = await request("/api/support-overview.php");
  verify(overview.response.status === 401 && typeof overview.data?.error === "string",
    "Support overview requires a bearer session");

  // This must never create a task: even a forged company/project cannot bypass sign-in.
  const unauthorizedCreate = await request("/api/support-ticket.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: "Unauthenticated probe (must be rejected)",
      message: "No task should be created",
      clientCode: "OTHER",
      project: "PROJ-OTHER",
    }),
  });
  verify(unauthorizedCreate.response.status === 401,
    "Support task creation rejects unauthenticated client/project overrides");
} catch (error) {
  console.error(`FAIL Support bridge production smoke: ${error.message}`);
  process.exitCode = 1;
}
