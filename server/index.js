import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const loadEnvFile = (envPath) => {
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

const loadEnvironment = () => {
  loadEnvFile(resolve(rootDir, ".env"));

  if (process.env.ODOO_ENV_PATH) {
    loadEnvFile(resolve(process.env.ODOO_ENV_PATH));
  }
};

loadEnvironment();

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

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`);

const userColumns = new Set(db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
const addUserColumn = (name, definition) => {
  if (!userColumns.has(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    userColumns.add(name);
  }
};

addUserColumn("login", "TEXT");
addUserColumn("odoo_uid", "INTEGER");
addUserColumn("odoo_partner_id", "INTEGER");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
  CREATE INDEX IF NOT EXISTS idx_users_odoo_uid ON users(odoo_uid);
`);

const getUserByEmail = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.login,
    users.password_hash,
    users.provider,
    users.google_sub,
    users.odoo_uid,
    users.odoo_partner_id,
    users.created_at,
    companies.company_name,
    companies.industry,
    companies.company_size,
    companies.website
  FROM users
  LEFT JOIN companies ON companies.user_id = users.id
  WHERE users.email = ?
`);

const getUserByOdooIdentity = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.login,
    users.password_hash,
    users.provider,
    users.google_sub,
    users.odoo_uid,
    users.odoo_partner_id,
    users.created_at,
    companies.company_name,
    companies.industry,
    companies.company_size,
    companies.website
  FROM users
  LEFT JOIN companies ON companies.user_id = users.id
  WHERE users.odoo_uid = ?
    OR users.login = ?
    OR users.email = ?
  LIMIT 1
`);

const insertUser = db.prepare(`
  INSERT INTO users (full_name, email, login, password_hash, provider, google_sub)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertOdooUser = db.prepare(`
  INSERT INTO users (full_name, email, login, password_hash, provider, google_sub, odoo_uid, odoo_partner_id)
  VALUES (?, ?, ?, NULL, 'Support', NULL, ?, ?)
`);

const updateOdooUser = db.prepare(`
  UPDATE users
  SET full_name = ?,
      email = ?,
      login = ?,
      provider = 'Support',
      odoo_uid = ?,
      odoo_partner_id = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const insertCompany = db.prepare(`
  INSERT INTO companies (user_id, company_name, industry, company_size, website)
  VALUES (?, ?, ?, ?, ?)
`);

const upsertCompany = db.prepare(`
  INSERT INTO companies (user_id, company_name, industry, company_size, website)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    company_name = excluded.company_name,
    industry = excluded.industry,
    company_size = excluded.company_size,
    website = excluded.website,
    updated_at = CURRENT_TIMESTAMP
`);

const updateSocialUser = db.prepare(`
  UPDATE users
  SET full_name = ?, provider = ?, google_sub = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const insertSession = db.prepare(`
  INSERT INTO sessions (user_id, token_hash, expires_at)
  VALUES (?, ?, datetime('now', ?))
`);

const deleteExpiredSessions = db.prepare(`
  DELETE FROM sessions
  WHERE expires_at <= CURRENT_TIMESTAMP
`);

const getSessionUser = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.login,
    users.password_hash,
    users.provider,
    users.google_sub,
    users.odoo_uid,
    users.odoo_partner_id,
    users.created_at,
    companies.company_name,
    companies.industry,
    companies.company_size,
    companies.website
  FROM sessions
  INNER JOIN users ON users.id = sessions.user_id
  LEFT JOIN companies ON companies.user_id = users.id
  WHERE sessions.token_hash = ?
    AND sessions.expires_at > CURRENT_TIMESTAMP
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

  if (/\s/.test(value)) {
    throw new Error("Company website cannot contain spaces.");
  }

  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  const normalizedValue = hasProtocol ? value : `https://${value}`;
  const parsed = new URL(normalizedValue);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Company website must use http or https.");
  }
  if (!parsed.hostname) {
    throw new Error("Company website must include a domain.");
  }

  return parsed.toString();
};

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const createSession = (userId) => {
  deleteExpiredSessions.run();
  const token = randomBytes(32).toString("base64url");
  const ttlHours = Math.max(1, Math.min(Number(process.env.SESSION_TTL_HOURS || 168), 720));
  insertSession.run(userId, hashToken(token), `+${ttlHours} hours`);
  return token;
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

const toPublicUser = (row, sessionToken = "") => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  login: row.login || row.email,
  provider: row.provider === "Odoo" ? "Support" : row.provider,
  company: row.company_name
    ? {
        name: row.company_name,
        industry: row.industry,
        size: row.company_size || "",
        website: row.website || "",
      }
    : null,
  createdAt: row.created_at,
  ...(sessionToken ? { sessionToken } : {}),
});

const getBearerToken = (request) => {
  const authHeader = request.headers.authorization || "";
  const [scheme, token] = authHeader.split(/\s+/);
  return /^bearer$/i.test(scheme || "") ? trim(token) : "";
};

const getAuthenticatedUser = (request) => {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  deleteExpiredSessions.run();
  return getSessionUser.get(hashToken(token)) || null;
};

const requireAuthenticatedUser = (request, response) => {
  const user = getAuthenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Please sign in to access the support portal." });
    return null;
  }

  return user;
};

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

const getOdooConfig = () => {
  const url = trim(process.env.ODOO_URL || process.env.odooUrl).replace(/\/$/, "");
  const dbName = trim(process.env.ODOO_DB || process.env.odooDb);
  const username = trim(process.env.ODOO_USERNAME || process.env.odooUsername);
  const password = trim(process.env.ODOO_PASSWORD || process.env.odooPassword);

  if (!url || !dbName || !username || !password) {
    return null;
  }

  return { url, dbName, username, password };
};

let odooSession = null;
let odooRequestId = 1;

const odooJsonRpc = async (path, params, useSession = true) => {
  const config = getOdooConfig();
  if (!config) {
    const error = new Error("Support portal is not configured.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(useSession && odooSession?.cookie ? { Cookie: odooSession.cookie } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params,
      id: odooRequestId++,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const message =
      payload?.error?.data?.message || payload?.error?.message || "Support system request failed.";
    const error = new Error(message);
    error.status = response.status || 502;
    throw error;
  }

  return {
    result: payload.result,
    setCookie: response.headers.get("set-cookie") || "",
  };
};

const authenticateOdoo = async () => {
  const config = getOdooConfig();
  if (!config) {
    const error = new Error("Support portal is not configured.");
    error.status = 503;
    throw error;
  }

  const { result, setCookie } = await odooJsonRpc(
    "/web/session/authenticate",
    {
      db: config.dbName,
      login: config.username,
      password: config.password,
    },
    false
  );

  if (!result?.uid) {
    const error = new Error("Support system authentication failed.");
    error.status = 502;
    throw error;
  }

  odooSession = {
    uid: result.uid,
    cookie: setCookie.split(";")[0],
    authenticatedAt: Date.now(),
  };
};

const callOdoo = async (model, method, args = [], kwargs = {}) => {
  if (!odooSession?.cookie) {
    await authenticateOdoo();
  }

  try {
    const { result } = await odooJsonRpc(
      `/web/dataset/call_kw/${model}/${method}`,
      { model, method, args, kwargs },
      true
    );
    return result;
  } catch (error) {
    odooSession = null;
    await authenticateOdoo();
    const { result } = await odooJsonRpc(
      `/web/dataset/call_kw/${model}/${method}`,
      { model, method, args, kwargs },
      true
    );
    return result;
  }
};

const htmlEscape = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatMany2one = (value) =>
  Array.isArray(value) && value.length >= 2 ? { id: value[0], name: value[1] } : null;

const publicIdentityValue = (login, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (isValidEmail(normalizedEmail)) {
    return normalizedEmail;
  }

  const normalizedLogin = normalizeEmail(login);
  return normalizedLogin || trim(login) || "support-user";
};

const upsertOdooAccount = (odooUser, requestedLogin) => {
  const partner = formatMany2one(odooUser.partner_id);
  const company = formatMany2one(odooUser.company_id);
  const login = trim(odooUser.login) || trim(requestedLogin);
  const email = publicIdentityValue(login, odooUser.email);
  const name = trim(odooUser.name) || login || email;
  const companyName = company?.name || partner?.name || "Customer";
  const partnerId = partner?.id || null;
  const existing = getUserByOdooIdentity.get(odooUser.id, login, email);

  let userId = existing?.id;
  if (existing) {
    updateOdooUser.run(name, email, login, odooUser.id, partnerId, existing.id);
  } else {
    const result = insertOdooUser.run(name, email, login, odooUser.id, partnerId);
    userId = result.lastInsertRowid;
  }

  upsertCompany.run(userId, companyName, "Customer", null, null);
  return getUserByEmail.get(email);
};

const authenticateOdooCustomer = async (login, password) => {
  const config = getOdooConfig();
  if (!config) {
    const error = new Error("Support portal is not configured.");
    error.status = 503;
    throw error;
  }

  let result;
  try {
    ({ result } = await odooJsonRpc(
      "/web/session/authenticate",
      {
        db: config.dbName,
        login,
        password,
        context: {},
      },
      false
    ));
  } catch (error) {
    const authError = new Error("Invalid username or password.");
    authError.status = error?.status === 503 ? 503 : 401;
    throw authError;
  }

  if (!result?.uid) {
    const error = new Error("Invalid username or password.");
    error.status = 401;
    throw error;
  }

  const [odooUser] = await callOdoo("res.users", "search_read", [[["id", "=", result.uid]]], {
    fields: ["id", "name", "login", "email", "partner_id", "company_id", "share", "active"],
    limit: 1,
  });

  if (!odooUser?.active) {
    const error = new Error("This user is inactive. Contact ABiT support.");
    error.status = 403;
    throw error;
  }

  return upsertOdooAccount(odooUser, login);
};

const combineOr = (conditions) => {
  const valid = conditions.filter(Boolean);
  if (!valid.length) {
    return [];
  }
  if (valid.length === 1) {
    return [valid[0]];
  }
  return [...Array(valid.length - 1).fill("|"), ...valid];
};

const priorityLabel = (priority) =>
  ({
    "0": "Low",
    "1": "Normal",
    "2": "High",
    "3": "Urgent",
  }[String(priority || "0")] || "Normal");

const stateLabel = (state) =>
  ({
    normal: "In progress",
    blocked: "Blocked",
    done: "Ready",
  }[String(state || "normal")] || "In progress");

const sanitizePortalText = (value) =>
  String(value ?? "")
    .replace(/odoo\s*bot/gi, "ABiT Team")
    .replace(/\bodoo\b/gi, "ERP");

const isDoneStage = (stageName) => /done|complete|closed|cancelled/i.test(stageName || "");

const getCustomerOdooContext = async (user) => {
  const email = isValidEmail(normalizeEmail(user.email)) ? normalizeEmail(user.email) : "";
  const login = trim(user.login || user.email);
  const odooPartnerId = Number(user.odoo_partner_id || 0);
  const companyName = trim(user.company_name);
  const allowCompanyMatch = String(process.env.ODOO_MATCH_COMPANY_NAME || "").toLowerCase() === "true";
  const partnerDomain = combineOr([
    odooPartnerId > 0 ? ["id", "=", odooPartnerId] : null,
    email ? ["email", "=", email] : null,
    allowCompanyMatch && companyName ? ["name", "=", companyName] : null,
  ]);

  const partners = partnerDomain.length
    ? await callOdoo("res.partner", "search_read", [partnerDomain], {
        fields: ["id", "name", "email", "parent_id", "commercial_partner_id"],
        limit: 25,
      })
    : [];

  const partnerIds = new Set();
  partners.forEach((partner) => {
    partnerIds.add(partner.id);
    const parent = formatMany2one(partner.parent_id);
    const commercial = formatMany2one(partner.commercial_partner_id);
    if (parent?.id) partnerIds.add(parent.id);
    if (commercial?.id) partnerIds.add(commercial.id);
  });

  return {
    email,
    login,
    companyName,
    partners,
    partnerIds: Array.from(partnerIds),
  };
};

const mapTicket = (ticket) => ({
  id: ticket.id,
  title: sanitizePortalText(ticket.name),
  stage: sanitizePortalText(formatMany2one(ticket.stage_id)?.name || "New"),
  state: stateLabel(ticket.kanban_state),
  priority: priorityLabel(ticket.priority),
  owner: sanitizePortalText(formatMany2one(ticket.user_id)?.name || "Unassigned"),
  project: sanitizePortalText(formatMany2one(ticket.project_id)?.name || ""),
  customer: sanitizePortalText(formatMany2one(ticket.partner_id)?.name || ticket.partner_email || ""),
  updatedAt: ticket.write_date,
  createdAt: ticket.create_date,
});

const mapTask = (task) => ({
  id: task.id,
  title: sanitizePortalText(task.name),
  stage: sanitizePortalText(formatMany2one(task.stage_id)?.name || "Open"),
  priority: priorityLabel(task.priority),
  project: sanitizePortalText(formatMany2one(task.project_id)?.name || ""),
  customer: sanitizePortalText(formatMany2one(task.partner_id)?.name || ""),
  deadline: task.date_deadline || "",
  plannedHours: Number(task.planned_hours || 0),
  effectiveHours: Number(task.effective_hours || 0),
  remainingHours: Number(task.remaining_hours || 0),
  updatedAt: task.write_date,
  createdAt: task.create_date,
});

const mapProject = (project, tasks = []) => {
  const relatedTasks = tasks.filter((task) => task.projectId === project.id);
  const doneCount = relatedTasks.filter((task) => isDoneStage(task.stage)).length;
  const totalTasks = relatedTasks.length;
  const progress = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;

  return {
    id: project.id,
    title: sanitizePortalText(project.name),
    stage: sanitizePortalText(formatMany2one(project.stage_id)?.name || "Active"),
    owner: sanitizePortalText(formatMany2one(project.user_id)?.name || "ABiT Team"),
    customer: sanitizePortalText(formatMany2one(project.partner_id)?.name || ""),
    description: sanitizePortalText(stripHtml(project.description).slice(0, 220)),
    openTasks: Math.max(totalTasks - doneCount, 0),
    totalTasks,
    progress,
    remainingHours: Number(project.remaining_hours || 0),
    updatedAt: project.write_date,
    createdAt: project.create_date,
  };
};

const fetchSupportOverview = async (user) => {
  const context = await getCustomerOdooContext(user);
  const partnerIds = context.partnerIds;
  const email = context.email;

  const ticketDomain = combineOr([
    partnerIds.length ? ["partner_id", "in", partnerIds] : null,
    email ? ["partner_email", "=", email] : null,
  ]);

  const tickets = ticketDomain.length
    ? await callOdoo("helpdesk.ticket", "search_read", [ticketDomain], {
        fields: [
          "id",
          "name",
          "stage_id",
          "kanban_state",
          "priority",
          "user_id",
          "partner_id",
          "partner_email",
          "project_id",
          "write_date",
          "create_date",
        ],
        order: "write_date desc",
        limit: 40,
      })
    : [];

  const ticketProjectIds = tickets
    .map((ticket) => formatMany2one(ticket.project_id)?.id)
    .filter(Boolean);

  const projectDomain = combineOr([
    partnerIds.length ? ["partner_id", "in", partnerIds] : null,
    ticketProjectIds.length ? ["id", "in", ticketProjectIds] : null,
  ]);

  const projects = projectDomain.length
    ? await callOdoo("project.project", "search_read", [projectDomain], {
        fields: [
          "id",
          "name",
          "description",
          "stage_id",
          "partner_id",
          "user_id",
          "remaining_hours",
          "write_date",
          "create_date",
        ],
        order: "write_date desc",
        limit: 30,
      })
    : [];

  const projectIds = projects.map((project) => project.id);
  const taskDomain = combineOr([
    partnerIds.length ? ["partner_id", "in", partnerIds] : null,
    projectIds.length ? ["project_id", "in", projectIds] : null,
  ]);

  const rawTasks = taskDomain.length
    ? await callOdoo("project.task", "search_read", [taskDomain], {
        fields: [
          "id",
          "name",
          "stage_id",
          "priority",
          "project_id",
          "partner_id",
          "date_deadline",
          "effective_hours",
          "remaining_hours",
          "write_date",
          "create_date",
        ],
        order: "write_date desc",
        limit: 80,
      })
    : [];

  const mappedTasks = rawTasks.map((task) => ({
    ...mapTask(task),
    projectId: formatMany2one(task.project_id)?.id || null,
  }));

  const portalTasks = mappedTasks.map(({ projectId, ...task }) => task).slice(0, 24);
  const portalProjects = projects.map((project) => mapProject(project, mappedTasks)).slice(0, 12);
  const portalTickets = tickets.map(mapTicket);

  return {
    customer: {
      name: user.full_name,
      email,
      company: user.company_name || "",
      matchedPartners: context.partners.map((partner) => ({
        id: partner.id,
        name: sanitizePortalText(partner.name),
        email: partner.email || "",
      })),
    },
    summary: {
      openTickets: portalTickets.filter((ticket) => !/done|closed|ready/i.test(ticket.stage)).length,
      activeProjects: portalProjects.length,
      activeTasks: portalTasks.filter((task) => !isDoneStage(task.stage)).length,
      blockedItems: portalTickets.filter((ticket) => ticket.state === "Blocked").length,
      lastUpdated: new Date().toISOString(),
    },
    tickets: portalTickets,
    projects: portalProjects,
    tasks: portalTasks,
  };
};

const getSupportTicketPayload = (body) => ({
  subject: trim(body?.subject).slice(0, 120),
  priority: ["0", "1", "2", "3"].includes(String(body?.priority)) ? String(body.priority) : "1",
  message: trim(body?.message).slice(0, 6000),
});

const createSupportTicket = async (user, body) => {
  const payload = getSupportTicketPayload(body);
  if (!payload.subject || !payload.message) {
    const error = new Error("Ticket subject and message are required.");
    error.status = 422;
    throw error;
  }

  const context = await getCustomerOdooContext(user);
  const firstPartnerId = context.partnerIds[0] || null;
  const submittedBy = context.email || context.login || user.email || user.login || "";
  const values = {
    name: payload.subject,
    description: `<p>${htmlEscape(payload.message).replace(/\n/g, "<br>")}</p><p><strong>Submitted by:</strong> ${htmlEscape(user.full_name)} (${htmlEscape(submittedBy)})</p>`,
    priority: payload.priority,
    kanban_state: "normal",
  };

  if (context.email) {
    values.partner_email = context.email;
  }

  if (firstPartnerId) {
    values.partner_id = firstPartnerId;
  }

  const teamId = Number(process.env.ODOO_HELPDESK_TEAM_ID || process.env.ODOO_TEAM_ID || 0);
  if (Number.isFinite(teamId) && teamId > 0) {
    values.team_id = teamId;
  }

  const ticketId = await callOdoo("helpdesk.ticket", "create", [values]);
  const [ticket] = await callOdoo("helpdesk.ticket", "search_read", [[["id", "=", ticketId]]], {
    fields: [
      "id",
      "name",
      "stage_id",
      "kanban_state",
      "priority",
      "user_id",
      "partner_id",
      "partner_email",
      "project_id",
      "write_date",
      "create_date",
    ],
    limit: 1,
  });

  return mapTicket(ticket);
};

const supportRecoveryMessage =
  "If this account is registered, recovery instructions were sent to the registered contact.";

const findSupportRecoveryUser = async (login) => {
  const requestedLogin = trim(login);
  const email = normalizeEmail(requestedLogin);
  const domain = combineOr([
    requestedLogin ? ["login", "=", requestedLogin] : null,
    isValidEmail(email) ? ["email", "=", email] : null,
  ]);

  if (!domain.length) {
    return null;
  }

  const users = await callOdoo("res.users", "search_read", [domain], {
    fields: ["id", "name", "login", "email", "partner_id", "active"],
    limit: 1,
  });

  return Array.isArray(users) ? users[0] || null : null;
};

const getRecoveryContact = async (user) => {
  const partner = formatMany2one(user?.partner_id);
  const contact = {
    email: trim(user?.email),
    phone: "",
  };

  if (!partner?.id) {
    return contact;
  }

  const partners = await callOdoo("res.partner", "search_read", [[["id", "=", partner.id]]], {
    fields: ["email", "mobile", "phone"],
    limit: 1,
  });
  const partnerRecord = Array.isArray(partners) ? partners[0] || null : null;
  contact.email ||= trim(partnerRecord?.email);
  contact.phone = trim(partnerRecord?.mobile) || trim(partnerRecord?.phone);
  return contact;
};

const normalizeWhatsappNumber = (phone) => {
  const normalized = trim(phone).replace(/[^\d+]/g, "");
  if (!normalized) {
    return "";
  }
  return normalized.startsWith("00") ? `+${normalized.slice(2)}` : normalized;
};

const recoveryNotificationText = (name) =>
  `Password recovery was requested for your ABiT support account${name ? ` (${name})` : ""}. For your security, use the recovery email or contact ABiT support if you did not request this.`;

const sendTwilioWhatsapp = async (phone, message) => {
  const accountSid = trim(process.env.TWILIO_ACCOUNT_SID);
  const authToken = trim(process.env.TWILIO_AUTH_TOKEN);
  const from = trim(process.env.TWILIO_WHATSAPP_FROM);
  if (!accountSid || !authToken || !from) {
    return false;
  }

  const to = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
  const body = new URLSearchParams({ From: from, To: to, Body: message });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!response.ok) {
    throw new Error("WhatsApp recovery notification failed.");
  }

  return true;
};

const sendMetaWhatsapp = async (phone, message) => {
  const token = trim(process.env.META_WA_TOKEN);
  const phoneNumberId = trim(process.env.META_WA_PHONE_NUMBER_ID);
  if (!token || !phoneNumberId) {
    return false;
  }

  const to = normalizeWhatsappNumber(phone).replace(/^\+/, "");
  if (!to) {
    return false;
  }

  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });

  if (!response.ok) {
    throw new Error("WhatsApp recovery notification failed.");
  }

  return true;
};

const sendWhatsappRecoveryNotification = async (phone, message) => {
  const normalizedPhone = normalizeWhatsappNumber(phone);
  if (!normalizedPhone) {
    return false;
  }

  const provider = trim(process.env.WHATSAPP_PROVIDER).toLowerCase();
  if (provider === "twilio") {
    return sendTwilioWhatsapp(normalizedPhone, message);
  }
  if (provider === "meta") {
    return sendMetaWhatsapp(normalizedPhone, message);
  }

  return (await sendMetaWhatsapp(normalizedPhone, message)) || (await sendTwilioWhatsapp(normalizedPhone, message));
};

const requestSupportPasswordRecovery = async (login) => {
  if (!getOdooConfig()) {
    return;
  }

  const user = await findSupportRecoveryUser(login);
  if (!user?.id || !user.active) {
    return;
  }

  const contact = await getRecoveryContact(user);
  const deliveryTasks = [];

  if (contact.email || isValidEmail(normalizeEmail(user.login))) {
    deliveryTasks.push(callOdoo("res.users", "action_reset_password", [[user.id]]));
  }

  if (contact.phone) {
    deliveryTasks.push(
      sendWhatsappRecoveryNotification(contact.phone, recoveryNotificationText(trim(user.name)))
    );
  }

  if (!deliveryTasks.length) {
    return;
  }

  const results = await Promise.allSettled(deliveryTasks);
  if (results.every((result) => result.status === "rejected")) {
    throw results[0].reason;
  }
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
  sendJson(response, 410, {
    error: "Customer accounts are provisioned by ABiT. Please use your assigned support login.",
  });
  return;

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
  const sessionToken = createSession(user.id);
  sendJson(response, 201, { user: toPublicUser(user, sessionToken) });
};

const handleSignin = async (request, response) => {
  const body = await readJsonBody(request);
  const login = trim(body?.login ?? body?.username ?? body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!login || !password) {
    sendJson(response, 422, { error: "Username and password are required." });
    return;
  }

  if (getOdooConfig()) {
    try {
      const user = await authenticateOdooCustomer(login, password);
      const sessionToken = createSession(user.id);
      sendJson(response, 200, { user: toPublicUser(user, sessionToken) });
    } catch (error) {
      sendJson(response, error.status || 401, {
        error: error instanceof Error ? error.message : "Invalid username or password.",
      });
    }
    return;
  }

  const email = normalizeEmail(login);
  if (!isValidEmail(email)) {
    sendJson(response, 422, { error: "A valid email address is required in local account mode." });
    return;
  }

  const user = getUserByEmail.get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    sendJson(response, 401, { error: "Invalid credentials. Please try again." });
    return;
  }

  const sessionToken = createSession(user.id);
  sendJson(response, 200, { user: toPublicUser(user, sessionToken) });
};

const handleSocialAuth = async (request, response) => {
  sendJson(response, 410, {
    error: "Customer support access uses ABiT-issued credentials only.",
  });
  return;

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
    insertUser.run(name, email, email, null, provider, googleSub);
    created = true;
  }

  user = getUserByEmail.get(email);
  const sessionToken = createSession(user.id);
  sendJson(response, created ? 201 : 200, { user: toPublicUser(user, sessionToken) });
};

const handleSupportOverview = async (request, response) => {
  const user = requireAuthenticatedUser(request, response);
  if (!user) {
    return;
  }

  const overview = await fetchSupportOverview(user);
  sendJson(response, 200, overview);
};

const handleSupportTicketCreate = async (request, response) => {
  const user = requireAuthenticatedUser(request, response);
  if (!user) {
    return;
  }

  const body = await readJsonBody(request);
  const ticket = await createSupportTicket(user, body);
  sendJson(response, 201, { ticket });
};

const handleSupportForgotPassword = async (request, response) => {
  const body = await readJsonBody(request);
  const login = trim(body?.login ?? body?.username ?? body?.email);

  if (!login) {
    sendJson(response, 422, { error: "Enter your username or registered email first." });
    return;
  }

  try {
    await requestSupportPasswordRecovery(login);
  } catch (error) {
    console.warn(
      "Support password recovery request could not be completed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  sendJson(response, 200, { message: supportRecoveryMessage });
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

    if (requestUrl.pathname === "/api/support/overview" && request.method === "GET") {
      await handleSupportOverview(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/support/forgot-password" && request.method === "POST") {
      await handleSupportForgotPassword(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/support/tickets" && request.method === "POST") {
      await handleSupportTicketCreate(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "API route not found." });
      return;
    }

    serveStatic(request, response, requestUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendJson(response, error.status || 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`ABiT server running at http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});
