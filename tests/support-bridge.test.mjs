import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { getSupportBridgeRoute, proxySupportBridge } from "../server/supportBridge.js";

function makeRequest(method, payload, authorization) {
  const request = Readable.from(payload === null ? [] : [Buffer.from(JSON.stringify(payload))]);
  request.method = method;
  request.headers = authorization ? { authorization } : {};
  return request;
}

function makeResponse() {
  return {
    status: null, headers: null, body: "",
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body = "") { this.body = body; },
  };
}

test("only fixed support endpoints use the ABITask bridge", () => {
  assert.equal(getSupportBridgeRoute("/api/signin.php", "POST"), "/api/signin");
  assert.equal(getSupportBridgeRoute("/api/support-overview.php", "GET"), "/api/support/overview");
  assert.equal(getSupportBridgeRoute("/api/support-ticket.php", "POST"), "/api/support/tickets");
  assert.equal(getSupportBridgeRoute("/api/support-forgot-password.php", "POST"), "/api/support/forgot-password");
  assert.equal(getSupportBridgeRoute("/api/support/tickets", "POST"), "/api/support/tickets");
  assert.equal(getSupportBridgeRoute("/api/signin", "POST"), null); // regular website accounts
  assert.equal(getSupportBridgeRoute("/api/signin.php", "GET"), null);
  assert.equal(getSupportBridgeRoute("/api/support/tickets/CHT", "GET"), null);
});

test("username login is sent to ABITask unchanged without requiring email", async () => {
  const request = makeRequest("POST", { login: "umar", password: "test-only" });
  const response = makeResponse();
  await proxySupportBridge(request, response, "/api/signin", {
    baseUrl: "https://bridge.example.test",
    fetchImpl: async (url, options) => {
      assert.equal(url.href, "https://bridge.example.test/api/signin");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body.toString()), { login: "umar", password: "test-only" });
      return new Response(JSON.stringify({
        user: { login: "umar", clientCode: "CHT", company: { name: "CHT" }, sessionToken: "test-session" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).user.clientCode, "CHT");
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("session token is forwarded, client filtering stays upstream", async () => {
  const request = makeRequest("GET", null, "Bearer test-session");
  const response = makeResponse();
  await proxySupportBridge(request, response, "/api/support/overview", {
    baseUrl: "https://bridge.example.test",
    fetchImpl: async (url, options) => {
      assert.equal(url.href, "https://bridge.example.test/api/support/overview");
      assert.equal(options.headers.Authorization, "Bearer test-session");
      return new Response(JSON.stringify({ summary: {}, projects: [], tickets: [], tasks: [] }),
        { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(response.status, 200);
});

test("upstream authorization failure is preserved, not replaced with local account validation", async () => {
  const request = makeRequest("POST", { login: "unknown", password: "wrong" });
  const response = makeResponse();
  await proxySupportBridge(request, response, "/api/signin", {
    baseUrl: "https://bridge.example.test",
    fetchImpl: async () => new Response(JSON.stringify({ error: "Invalid credentials." }), {
      status: 401, headers: { "content-type": "application/json" },
    }),
  });
  assert.equal(response.status, 401);
  assert.match(response.body, /Invalid credentials/);
});

test("rejects HTML upstream failures rather than returning a fake workspace", async () => {
  const response = makeResponse();
  await proxySupportBridge(makeRequest("GET", null, "Bearer test-session"), response, "/api/support/overview", {
    baseUrl: "https://bridge.example.test",
    fetchImpl: async () => new Response("<html>not logged in</html>", { status: 200, headers: { "content-type": "text/html" } }),
  });
  assert.equal(response.status, 502);
});

test("ticket creation discards client and project overrides", async () => {
  const request = makeRequest("POST", {
    subject: "ERP task", message: "Check CHT data", priority: "2",
    clientCode: "OTHER", company: "OTHER", project: "PROJ-OTHER",
  }, "Bearer test-session");
  const response = makeResponse();
  await proxySupportBridge(request, response, "/api/support/tickets", {
    baseUrl: "https://bridge.example.test",
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, "/api/support/tickets");
      assert.equal(options.headers.Authorization, "Bearer test-session");
      assert.deepEqual(JSON.parse(options.body.toString()), {
        subject: "ERP task", message: "Check CHT data", priority: "2",
      });
      return new Response(JSON.stringify({ ticket: { name: "TASK-TEST" } }),
        { status: 201, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(response.status, 201);
});

test("unauthorized overview and ticket creation fail before reaching the bridge", async () => {
  for (const [method, path, payload] of [
    ["GET", "/api/support/overview", null],
    ["POST", "/api/support/tickets", { subject: "x", message: "x" }],
  ]) {
    const response = makeResponse();
    await proxySupportBridge(makeRequest(method, payload), response, path, {
      fetchImpl: () => { throw new Error("Must not call upstream"); },
    });
    assert.equal(response.status, 401);
  }
});
