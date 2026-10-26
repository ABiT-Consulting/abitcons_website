const routes = new Map([
  ["/api/signin.php", { method: "POST", upstream: "/api/signin" }],
  ["/api/support-overview.php", { method: "GET", upstream: "/api/support/overview" }],
  ["/api/support-ticket.php", { method: "POST", upstream: "/api/support/tickets" }],
  ["/api/support-forgot-password.php", { method: "POST", upstream: "/api/support/forgot-password" }],
  ["/api/support/overview", { method: "GET", upstream: "/api/support/overview" }],
  ["/api/support/tickets", { method: "POST", upstream: "/api/support/tickets" }],
  ["/api/support/forgot-password", { method: "POST", upstream: "/api/support/forgot-password" }],
]);

export function getSupportBridgeRoute(pathname, method) {
  const route = routes.get(pathname);
  return route?.method === method ? route.upstream : null;
}

const jsonError = (response, status, error) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ error }));
};

async function requestBody(request, maxBytes = 1_000_000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Only fixed, company-agnostic bridge routes are reachable through this proxy.
// The ABITask session token, not a client code supplied by the browser, determines scope.
export async function proxySupportBridge(request, response, upstreamPath, {
  baseUrl = process.env.ABIT_TASK_PORTAL_BRIDGE_URL || "https://abitask.abit.ai",
  fetchImpl = fetch,
} = {}) {
  let upstreamUrl;
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== "https:" &&
        !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
      throw new Error("Invalid bridge protocol");
    }
    upstreamUrl = new URL(upstreamPath, base.origin);
  } catch {
    jsonError(response, 503, "Support portal bridge is not configured.");
    return;
  }

  try {
    const headers = { Accept: "application/json" };
    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && /^Bearer\s+\S{1,4096}$/i.test(authorization)) {
      headers.Authorization = authorization;
    }
    if (["/api/support/overview", "/api/support/tickets"].includes(upstreamPath) &&
        !headers.Authorization) {
      jsonError(response, 401, "Please sign in to access the support portal.");
      return;
    }
    let body;
    if (request.method !== "GET") {
      const raw = await requestBody(request, 65_536);
      let input;
      try { input = JSON.parse(raw.toString("utf8")); } catch { /* validated below */ }
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        jsonError(response, 400, "A valid JSON object is required.");
        return;
      }
      const string = (value) => typeof value === "string" ? value.trim() : "";
      let payload;
      if (upstreamPath === "/api/signin") {
        payload = {
          login: string(input.login ?? input.username ?? input.email),
          password: typeof input.password === "string" ? input.password : "",
        };
        if (!payload.login || !payload.password) {
          jsonError(response, 422, "Username and password are required.");
          return;
        }
      } else if (upstreamPath === "/api/support/forgot-password") {
        payload = { login: string(input.login ?? input.username ?? input.email) };
        if (!payload.login) {
          jsonError(response, 422, "Enter your username or registered email first.");
          return;
        }
      } else {
        // The bridge resolves company and ERP project exclusively from the session.
        // Discard caller-supplied clientCode, company and project overrides.
        payload = {
          subject: string(input.subject),
          message: string(input.message),
          priority: string(input.priority) || "1",
        };
        if (!payload.subject || !payload.message) {
          jsonError(response, 422, "Ticket subject and details are required.");
          return;
        }
      }
      body = Buffer.from(JSON.stringify(payload));
      headers["Content-Type"] = "application/json";
    }

    const upstreamResponse = await fetchImpl(upstreamUrl, {
      method: request.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const responseBody = await upstreamResponse.text();
    let parsedResponse;
    try { parsedResponse = JSON.parse(responseBody); } catch { /* invalid JSON is rejected below */ }
    if (!contentType.toLowerCase().includes("application/json") ||
        responseBody.length > 2_000_000 ||
        upstreamResponse.status < 200 || upstreamResponse.status > 499 ||
        !parsedResponse || typeof parsedResponse !== "object" || Array.isArray(parsedResponse)) {
      jsonError(response, 502, "Support portal bridge returned an invalid response.");
      return;
    }
    response.writeHead(upstreamResponse.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(responseBody);
  } catch (error) {
    jsonError(response, error?.status === 413 ? 413 : 502,
      error?.status === 413 ? "Request body is too large." : "Support portal bridge is unavailable.");
  }
}
