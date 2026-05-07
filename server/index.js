import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const loadLocalEnv = () => {
  const envPath = resolve(rootDir, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
};

loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const publicDir = resolve(rootDir, "dist");
const dbPath = resolve(rootDir, process.env.SQLITE_PATH || "data/abitcons.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    provider TEXT NOT NULL DEFAULT 'Email',
    google_sub TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    industry TEXT NOT NULL,
    company_size TEXT,
    website TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const getUserByEmail = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.password_hash,
    users.provider,
    users.google_sub,
    users.created_at,
    companies.company_name,
    companies.industry,
    companies.company_size,
    companies.website
  FROM users
  LEFT JOIN companies ON companies.user_id = users.id
  WHERE users.email = ?
`);

const insertUser = db.prepare(`
  INSERT INTO users (full_name, email, password_hash, provider, google_sub)
  VALUES (?, ?, ?, ?, ?)
`);

const insertCompany = db.prepare(`
  INSERT INTO companies (user_id, company_name, industry, company_size, website)
  VALUES (?, ?, ?, ?, ?)
`);

const updateSocialUser = db.prepare(`
  UPDATE users
  SET full_name = ?, provider = ?, google_sub = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const trim = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeEmail = (value) => trim(value).toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizeWebsite = (website) => {
  const value = trim(website);
  if (!value) {
    return "";
  }

  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Company website must start with http:// or https://.");
  }

  return parsed.toString();
};

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const toPublicUser = (row) => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  provider: row.provider,
  company: row.company_name
    ? {
        name: row.company_name,
        industry: row.industry,
        size: row.company_size || "",
        website: row.website || "",
      }
    : null,
  createdAt: row.created_at,
});

const readJsonBody = (request) =>
  new Promise((resolveJson, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolveJson({});
        return;
      }

      try {
        resolveJson(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
};

const getRegistrationPayload = (body) => {
  const source = body && typeof body === "object" ? body : {};
  const company = source.company && typeof source.company === "object" ? source.company : {};
  let website = "";

  try {
    website = normalizeWebsite(company.website ?? source.companyWebsite);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Company website is invalid.",
    };
  }

  return {
    name: trim(source.name),
    email: normalizeEmail(source.email),
    password: typeof source.password === "string" ? source.password : "",
    companyName: trim(company.name ?? source.companyName),
    industry: trim(company.industry ?? source.industry),
    companySize: trim(company.size ?? source.companySize),
    website,
  };
};

const handleRegister = async (request, response) => {
  const body = await readJsonBody(request);
  const payload = getRegistrationPayload(body);

  if (payload.error) {
    sendJson(response, 422, { error: payload.error });
    return;
  }

  const errors = [];
  if (!payload.name) errors.push("Full name is required.");
  if (!isValidEmail(payload.email)) errors.push("A valid work email is required.");
  if (payload.password.length < 8) errors.push("Password must be at least 8 characters.");
  if (!payload.companyName) errors.push("Company name is required.");
  if (!payload.industry) errors.push("Industry is required.");

  if (errors.length) {
    sendJson(response, 422, { error: errors[0], details: errors });
    return;
  }

  try {
    db.exec("BEGIN IMMEDIATE");
    const result = insertUser.run(
      payload.name,
      payload.email,
      hashPassword(payload.password),
      "Email",
      null
    );
    insertCompany.run(
      result.lastInsertRowid,
      payload.companyName,
      payload.industry,
      payload.companySize || null,
      payload.website || null
    );
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Ignore rollback failures caused by SQLite already closing the transaction.
    }

    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
      sendJson(response, 409, { error: "This email is already registered. Please sign in." });
      return;
    }

    throw error;
  }

  const user = getUserByEmail.get(payload.email);
  sendJson(response, 201, { user: toPublicUser(user) });
};

const handleSignin = async (request, response) => {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidEmail(email) || !password) {
    sendJson(response, 422, { error: "Email and password are required." });
    return;
  }

  const user = getUserByEmail.get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    sendJson(response, 401, { error: "Invalid credentials. Please try again." });
    return;
  }

  sendJson(response, 200, { user: toPublicUser(user) });
};

const handleSocialAuth = async (request, response) => {
  const body = await readJsonBody(request);
  const provider = trim(body?.provider);
  const accessToken = trim(body?.accessToken);

  if (provider !== "Google" || !accessToken) {
    sendJson(response, 422, { error: "A valid Google profile is required." });
    return;
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileResponse.ok) {
    sendJson(response, 401, { error: "Google profile could not be verified." });
    return;
  }

  const profile = await profileResponse.json();
  const name = trim(profile.name) || normalizeEmail(profile.email);
  const email = normalizeEmail(profile.email);
  const googleSub = trim(profile.sub);

  if (!name || !isValidEmail(email) || !googleSub) {
    sendJson(response, 422, { error: "A valid Google profile is required." });
    return;
  }

  let user = getUserByEmail.get(email);
  let created = false;
  if (user) {
    updateSocialUser.run(name, provider, googleSub, user.id);
  } else {
    insertUser.run(name, email, null, provider, googleSub);
    created = true;
  }

  user = getUserByEmail.get(email);
  sendJson(response, created ? 201 : 200, { user: toPublicUser(user) });
};

const serveStatic = (request, response, requestUrl) => {
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/") {
    pathname = "/index.html";
  }

  let filePath = resolve(publicDir, `.${pathname}`);
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(publicDir, "index.html");
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Build output not found. Run npm run build first.");
    return;
  }

  const extension = extname(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (requestUrl.pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/api/register" && request.method === "POST") {
      await handleRegister(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/signin" && request.method === "POST") {
      await handleSignin(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/social-auth" && request.method === "POST") {
      await handleSocialAuth(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "API route not found." });
      return;
    }

    serveStatic(request, response, requestUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`ABiT server running at http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});
