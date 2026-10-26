import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const trim = (value) => String(value ?? "").trim();
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const priorityMap = { "0": "Low", "1": "Medium", "2": "High", "3": "Urgent" };

const readJson = async (response) => {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    const message =
      data?.message ||
      data?.exception ||
      data?.exc_type ||
      data?._server_messages ||
      ("ERPNext request failed with HTTP " + response.status);
    const error = new Error(typeof message === "string" ? message.slice(0, 700) : "ERPNext request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
};

export function createErpSupportService({ rootDir }) {
  const baseUrl = trim(process.env.ERPNEXT_SUPPORT_URL || process.env.ERPNEXT_URL).replace(/\/$/, "");
  const apiKey = trim(process.env.ERPNEXT_SUPPORT_API_KEY || process.env.ERPNEXT_API_KEY);
  const apiSecret = trim(process.env.ERPNEXT_SUPPORT_API_SECRET || process.env.ERPNEXT_API_SECRET);

  if (!baseUrl || !apiKey || !apiSecret) {
    return { enabled: false };
  }

  const dbPath = resolve(rootDir, process.env.SUPPORT_SESSION_DB || "data/support-erp.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS erp_support_sessions (
      token_hash TEXT PRIMARY KEY,
      erp_user TEXT NOT NULL,
      login TEXT NOT NULL,
      full_name TEXT NOT NULL,
      customer TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_erp_support_sessions_expiry
      ON erp_support_sessions(expires_at);
  `);
  const insertSession = db.prepare(`
    INSERT INTO erp_support_sessions
      (token_hash, erp_user, login, full_name, customer, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
  `);
  const getSession = db.prepare(`
    SELECT erp_user, login, full_name, customer, expires_at
    FROM erp_support_sessions
    WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP
  `);
  const deleteExpired = db.prepare("DELETE FROM erp_support_sessions WHERE expires_at <= CURRENT_TIMESTAMP");

  const adminHeaders = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  // Retry only read-only ERP requests on short-lived upstream outages.
  // Login/password and task creation requests are never retried.
  const erpRequest = async (method, path, body = undefined, headers = {}) => {
    const options = {
      method,
      headers: {
        ...adminHeaders,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    for (let attempt = 0; attempt < (method === "GET" ? 2 : 1); attempt++) {
      try {
        const response = await fetch(baseUrl + path, {
          ...options,
          signal: AbortSignal.timeout(30000),
        });
        if (method === "GET" && attempt === 0 &&
            [502, 503, 504].includes(response.status)) {
          await new Promise(resolve => setTimeout(resolve, 250));
          continue;
        }
        return await readJson(response);
      } catch (error) {
        const transient = !error?.status || [502, 503, 504].includes(error.status);
        if (method !== "GET" || attempt !== 0 || !transient) {
          if (!error?.status) {
            const unavailable = new Error("ERPNext did not respond. Please try again.");
            unavailable.status = 503;
            throw unavailable;
          }
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    const unavailable = new Error("ERPNext could not complete the request.");
    unavailable.status = 503;
    throw unavailable;
  };
  const erpList = async (doctype, { fields = ["name"], filters = [], orderBy = "", limit = 500, start = 0 } = {}) => {
    const query = new URLSearchParams({
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: String(limit),
      limit_start: String(start),
    });
    if (orderBy) query.set("order_by", orderBy);
    const data = await erpRequest("GET", "/api/resource/" + encodeURIComponent(doctype) + "?" + query);
    return Array.isArray(data.data) ? data.data : [];
  };

  // Fetch all pages so the administrator does not silently miss older tasks.
  const erpListAll = async (doctype, options = {}) => {
    const results = [];
    const pageSize = 500;
    for (let start = 0; start < 20000; start += pageSize) {
      const page = await erpList(doctype, { ...options, limit: pageSize, start });
      results.push(...page);
      if (page.length < pageSize) return results;
    }
    throw new Error("Support result limit reached; narrow the ERP dataset.");
  };
  // Frappe denies service-token access to its built-in Administrator User (403).
  // For that *exact* principal only, read the User record through the session
  // created by the successful ERPNext password login. Never grant a support
  // role from the login name alone: custom_support_admin must still be enabled.
  // Keep the ERP session cookie in process memory, bound to a hashed support
  // token. It is never returned to the browser or written to SQLite.
  const privilegedErpSessions = new Map();
  const fetchVerifiedUser = async (erpUser, verifiedCookie = "") => {
    const resource = "/api/resource/User/" + encodeURIComponent(erpUser);
    try {
      return (await erpRequest("GET", resource)).data;
    } catch (error) {
      if (erpUser !== "Administrator" && error?.status === 403) {
        const denied = new Error("ERPNext denied permission to verify this account's support access. Ask your ERP administrator to check the support bridge API user's User read permission.");
        denied.status = 403;
        throw denied;
      }
      if (erpUser !== "Administrator" || error?.status !== 403) throw error;
      if (!verifiedCookie) {
        const unauthorized = new Error("ERPNext Administrator session is no longer available. Sign in again.");
        unauthorized.status = 401;
        throw unauthorized;
      }
      let response;
      try {
        response = await fetch(baseUrl + resource, {
          headers: { Cookie: verifiedCookie, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        const unavailable = new Error("Unable to validate the ERPNext Administrator session.");
        unavailable.status = 502;
        throw unavailable;
      }
      if (response.status === 403) {
        // Even an authenticated Administrator may be blocked from the User
        // resource. Ask Frappe's read-only permission-checked method for
        // the exact record and the actual Support Admin checkbox.
        const query = new URLSearchParams({
          doctype: "User",
          filters: JSON.stringify({ name: "Administrator" }),
          fieldname: JSON.stringify([
            "name", "enabled", "username", "full_name", "email",
            "custom_support_admin", "custom_support_portal_enabled",
            "custom_support_customer",
          ]),
        });
        try {
          const fallback = await fetch(
            baseUrl + "/api/method/frappe.client.get_value?" + query,
            {
              headers: { Cookie: verifiedCookie, Accept: "application/json" },
              signal: AbortSignal.timeout(15000),
            }
          );
          if (fallback.ok) {
            const result = await readJson(fallback);
            if (result.message?.name === "Administrator") return result.message;
          }
        } catch {
          // If the ERP permissions deny both checks, do not grant access.
        }
      }
      if (!response.ok) {
        const denied = new Error(response.status === 401 || response.status === 403
          ? "ERPNext did not allow reading the Administrator support role. Use a named ERPNext user whose Support Admin checkbox is enabled."
          : "ERPNext user permissions could not be verified.");
        denied.status = response.status === 401 ? 401 : response.status === 403 ? 403 : 502;
        throw denied;
      }
      const data = await readJson(response);
      return data.data;
    }
  };
  const validateMappedUser = async (erpUser, verifiedCookie = "") => {
    const doc = await fetchVerifiedUser(erpUser, verifiedCookie);
    const isSupportAdmin = Number(doc?.custom_support_admin || 0) === 1;
    if (!doc?.enabled || (!isSupportAdmin && Number(doc.custom_support_portal_enabled || 0) !== 1)) {
      const error = new Error("This ERP user is not enabled for the support portal.");
      error.status = 403;
      throw error;
    }
    const customer = isSupportAdmin ? "__SUPPORT_ADMIN__" : trim(doc.custom_support_customer);
    if (!customer) {
      const error = new Error("No support customer is assigned to this ERP user.");
      error.status = 403;
      throw error;
    }
    return {
      erpUser: doc.name,
      login: trim(doc.username) || doc.name,
      fullName: trim(doc.full_name) || trim(doc.first_name) || trim(doc.username) || doc.name,
      email: trim(doc.custom_support_email) || trim(doc.email) || doc.name,
      customer,
      isSupportAdmin,
    };
  };

  // Frappe can accept the email ID while rejecting its short username.
  // Resolve only an exact, unique enabled User.username, using server-side
  // configured ERP credentials; never reveal that lookup to the browser.
  // Password authentication still happens exclusively at ERPNext.
  const resolveCanonicalLogin = async (input) => {
    const supplied = trim(input);
    if (!supplied || supplied.includes("@")) return supplied;
    if (supplied.toLowerCase() === "administrator") return "Administrator";
    try {
      const records = await erpList("User", {
        fields: ["name", "username", "enabled"],
        filters: [["username", "=", supplied]],
        limit: 2,
      });
      if (records.length === 1 &&
          Number(records[0].enabled) === 1 &&
          trim(records[0].username).toLowerCase() === supplied.toLowerCase()) {
        return trim(records[0].name);
      }
    } catch (error) {
      // Do not misreport an ERP outage as a wrong password, which could
      // otherwise cause repeated login attempts and Frappe rate limiting.
      if (!error?.status || error.status === 429 || error.status >= 500) {
        const unavailable = new Error("ERPNext username lookup is temporarily unavailable. Use your ERPNext email or retry later.");
        unavailable.status = 503;
        throw unavailable;
      }
      // When lookup is denied but native ERPNext username login is enabled,
      // leave the supplied username unchanged; ERPNext still checks password.
    }
    return supplied;
  };
  const login = async (loginValue, password) => {
    const login = trim(loginValue);
    if (!login || !password) {
      const error = new Error("Username and password are required.");
      error.status = 422;
      throw error;
    }

    const canonicalLogin = await resolveCanonicalLogin(login);
    const form = new URLSearchParams({ usr: canonicalLogin, pwd: String(password) });
    // Never automatically repeat the password POST. A temporary outage is
    // different from a rejected password or missing Support Admin checkbox.
    let response;
    try {
      response = await fetch(baseUrl + "/api/method/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: form,
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      const unavailable = new Error("ERPNext sign-in service did not respond. Your password could not be checked; please retry.");
      unavailable.status = 503;
      throw unavailable;
    }
    if (!response.ok) {
      // Keep authentication exclusively in ERPNext. Never allow a Support Admin
      // checkbox, display name or alias to bypass password verification.
      const invalidCredentials = response.status === 401 || response.status === 403;
      const error = new Error(invalidCredentials
        ? "ERPNext rejected these login credentials. Use your ERPNext username/email and account password. The Support Admin checkbox does not set a password. Select Forgot password to reset it."
        : response.status === 429
          ? "ERPNext has temporarily limited sign-in attempts. Please try again later."
          : "ERPNext sign-in is temporarily unavailable. Please try again later.");
      error.status = invalidCredentials ? 401 : response.status === 429 ? 429 : 502;
      throw error;
    }

    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie") || ""];
    const cookie = setCookies
      .filter(Boolean)
      .map((item) => item.split(";")[0])
      .join("; ");

    if (!cookie) {
      const error = new Error("ERP login did not return a session.");
      error.status = 502;
      throw error;
    }

    let who;
    try {
      const whoResponse = await fetch(baseUrl + "/api/method/frappe.auth.get_logged_user", {
        headers: { Cookie: cookie, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      who = await readJson(whoResponse);
    } catch (error) {
      const unavailable = new Error(error?.status === 403
        ? "ERPNext accepted the sign-in request but would not verify its session. Please retry or contact your ERP administrator."
        : "ERPNext session verification could not be completed. Please retry.");
      unavailable.status = 503;
      throw unavailable;
    }    const erpUser = trim(who.message);
    if (!erpUser || erpUser === "Guest") {
      const error = new Error("ERP login could not resolve the user.");
      error.status = 401;
      throw error;
    }

    const mapped = await validateMappedUser(erpUser, cookie);
    deleteExpired.run();
    const token = randomBytes(32).toString("base64url");
    const ttlHours = Math.max(1, Math.min(Number(process.env.SUPPORT_SESSION_TTL_HOURS || 8), 24));
    insertSession.run(hashToken(token), mapped.erpUser, mapped.login, mapped.fullName, mapped.customer, "+" + ttlHours + " hours");
    if (mapped.erpUser === "Administrator") {
      // Limit in-memory ERP session cookies to the verified support TTL.
      const now = Date.now();
      for (const [storedHash, info] of privilegedErpSessions) {
        if (info.expiresAt <= now) privilegedErpSessions.delete(storedHash);
      }
      privilegedErpSessions.set(hashToken(token), {
        cookie,
        expiresAt: now + ttlHours * 3600000,
      });
    }

    return {
      sessionToken: token,
      login: mapped.login,
      name: mapped.fullName,
      email: mapped.email,
      company: { name: mapped.isSupportAdmin ? "ABiT Support Admin" : mapped.customer, code: mapped.isSupportAdmin ? "ADMIN" : mapped.customer },
      isSupportAdmin: mapped.isSupportAdmin,
      clientCode: mapped.isSupportAdmin ? "ADMIN" : mapped.customer,
      supportUrl: "#support-portal/" + encodeURIComponent(mapped.isSupportAdmin ? "ADMIN" : mapped.customer),
    };
  };

  const getSessionFromRequest = (request) => {
    const header = request.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    deleteExpired.run();
    return getSession.get(hashToken(match[1].trim())) || null;
  };

  const requireSession = async (request) => {
    const session = getSessionFromRequest(request);
    if (!session) {
      const error = new Error("Your support session has expired. Please sign in again.");
      error.status = 401;
      throw error;
    }

    const header = String(request.headers.authorization || "");
    const credential = header.match(/^Bearer\s+(.+)$/i);
    const storedHash = credential ? hashToken(credential[1].trim()) : "";
    const privilegedEntry = session.erp_user === "Administrator" && storedHash
      ? privilegedErpSessions.get(storedHash)
      : null;
    if (privilegedEntry && privilegedEntry.expiresAt <= Date.now()) {
      privilegedErpSessions.delete(storedHash);
    }
    const privilegedCookie = privilegedEntry && privilegedEntry.expiresAt > Date.now()
      ? privilegedEntry.cookie
      : "";
    const current = await validateMappedUser(session.erp_user, privilegedCookie);
    if (current.customer !== session.customer) {
      const error = new Error("Your ERP support mapping has changed. Please sign in again.");
      error.status = 401;
      throw error;
    }
    return { ...session, ...current };
  };

  const getProjects = async (customer) =>
    erpListAll("Project", {
      fields: ["name", "project_name", "status", "percent_complete", "modified", "custom_support_customer"],
      filters: [["custom_support_customer", "=", customer], ["is_active", "=", "Yes"]],
      orderBy: "modified desc",
      limit: 200,
    });

  // Only companies with at least one active ERP user enabled for support
  // are visible in the ABiT Support Admin workspace.
  const getSupportedCustomers = async () => {
    const users = await erpListAll("User", {
      fields: ["name", "enabled", "custom_support_portal_enabled", "custom_support_customer"],
      filters: [["enabled", "=", 1], ["custom_support_portal_enabled", "=", 1]],
    });
    return [...new Set(users.map((user) => trim(user.custom_support_customer)).filter(Boolean))];
  };

  const getAccessibleProjects = async (session, allowedCustomers = null) => {
    if (!session.isSupportAdmin) return getProjects(session.customer);
    const customers = allowedCustomers || await getSupportedCustomers();
    const projects = [];
    for (let i = 0; i < customers.length; i += 5) {
      const batch = await Promise.all(customers.slice(i, i + 5).map(getProjects));
      projects.push(...batch.flat());
    }
    return projects;
  };
  const getTasks = async (projectNames) => {
    if (!projectNames.length) return [];
    return erpListAll("Task", {
      fields: ["name", "subject", "status", "description", "project", "priority", "exp_end_date", "modified", "modified_by", "_assign"],
      filters: [["project", "in", projectNames]],
      orderBy: "modified desc",
      limit: 1000,
    });
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getAccessibleTask = async (session, taskId) => {
    const requestedTask = trim(taskId);
    if (!requestedTask) {
      const error = new Error("Task ID is required.");
      error.status = 422;
      throw error;
    }

    let task;
    try {
      task = (await erpRequest("GET", "/api/resource/Task/" + encodeURIComponent(requestedTask))).data;
    } catch (error) {
      const safeError = new Error("Support task was not found.");
      safeError.status = error?.status === 404 ? 404 : 403;
      throw safeError;
    }

    const projects = await getAccessibleProjects(session);
    const allowedProjects = new Set(projects.map((project) => project.name));
    if (!task?.project || !allowedProjects.has(task.project)) {
      const error = new Error("You do not have access to this support task.");
      error.status = 403;
      throw error;
    }

    return task;
  };

  const getTaskActivity = async (request, taskId) => {
    const session = await requireSession(request);
    const task = await getAccessibleTask(session, taskId);

    const [comments, communications] = await Promise.all([
      erpList("Comment", {
        fields: [
          "name",
          "comment_type",
          "content",
          "comment_email",
          "comment_by",
          "owner",
          "creation",
          "modified",
          "reference_doctype",
          "reference_name",
        ],
        filters: [
          ["reference_doctype", "=", "Task"],
          ["reference_name", "=", task.name],
        ],
        orderBy: "creation asc",
        limit: 500,
      }),
      erpList("Communication", {
        fields: [
          "name",
          "communication_type",
          "communication_medium",
          "sent_or_received",
          "subject",
          "content",
          "sender",
          "recipients",
          "cc",
          "communication_date",
          "creation",
          "owner",
          "reference_doctype",
          "reference_name",
        ],
        filters: [
          ["reference_doctype", "=", "Task"],
          ["reference_name", "=", task.name],
        ],
        orderBy: "communication_date asc",
        limit: 500,
      }),
    ]);

    const activity = [
      ...comments.map((comment) => {
        const content = comment.content || "";
        const looksLikeEmailUpdate = /\bemail\b|gmail|sent direct follow-up|email chase/i.test(content);
        return {
          id: comment.name,
          type: looksLikeEmailUpdate ? "email-log" : "activity",
          activityType: looksLikeEmailUpdate ? "Email update" : (comment.comment_type || "Comment"),
          direction: "",
          subject: "",
          content,
          author: comment.comment_by || comment.comment_email || comment.owner || "ABiT Team",
          sender: comment.comment_email || comment.owner || "",
          recipients: "",
          date: comment.creation || comment.modified,
        };
      }),
      ...communications.map((communication) => ({
        id: communication.name,
        type: "email",
        activityType: communication.communication_medium || communication.communication_type || "Email",
        direction: communication.sent_or_received || "",
        subject: communication.subject || "",
        content: communication.content || "",
        author: communication.sender || communication.owner || "ABiT Team",
        sender: communication.sender || "",
        recipients: communication.recipients || "",
        cc: communication.cc || "",
        date: communication.communication_date || communication.creation,
      })),
    ]
      .filter((item) => item.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      task: {
        id: task.name,
        title: task.subject || task.name,
        project: task.project || "",
        status: task.status || "Open",
        expectedDueDate: task.exp_end_date || null,
        updatedAt: task.modified || null,
      },
      activity,
    };
  };

  const addTaskReply = async (request, taskId, body) => {
    const session = await requireSession(request);
    const task = await getAccessibleTask(session, taskId);
    const message = trim(body?.message ?? body?.content).slice(0, 8000);

    if (!message) {
      const error = new Error("Reply message is required.");
      error.status = 422;
      throw error;
    }

    const safeContent = "<p>" + escapeHtml(message).replace(/\n/g, "<br>") + "</p>";
    const comment = (await erpRequest("POST", "/api/resource/Comment", {
      comment_type: "Comment",
      reference_doctype: "Task",
      reference_name: task.name,
      content: safeContent,
      comment_email: session.erpUser || session.erp_user,
      comment_by: session.fullName || session.full_name || session.login,
    })).data;

    return {
      success: true,
      reply: {
        id: comment.name,
        type: "activity",
        activityType: "Comment",
        direction: "",
        subject: "",
        content: comment.content || safeContent,
        author: session.fullName || session.full_name || session.login,
        sender: session.email || session.erpUser || session.erp_user,
        recipients: "",
        date: comment.creation || new Date().toISOString(),
      },
    };
  };

  const notifyTaskAssignees = async (request, taskId, body) => {
    const session = await requireSession(request);
    if (!session.isSupportAdmin) {
      const error = new Error("Support Admin permission required.");
      error.status = 403;
      throw error;
    }
    const task = await getAccessibleTask(session, taskId);
    const message = trim(body?.message).slice(0, 4000);
    if (!message) {
      const error = new Error("Instructions are required.");
      error.status = 422;
      throw error;
    }
    let assigned = [];
    try {
      assigned = JSON.parse(task._assign || "[]");
    } catch {
      assigned = [];
    }
    const recipients = [...new Set(Array.isArray(assigned) ? assigned.filter((x) => typeof x === "string" && x.trim()).map(trim) : [])].slice(0, 20);
    if (!recipients.length) {
      const error = new Error("Assign an ERPNext user to this task before notifying the team.");
      error.status = 422;
      throw error;
    }
    const subject = "Support task #" + task.name + ": " + (task.subject || "Task update");
    const content = "<p>" + escapeHtml(message).replace(/\n/g, "<br>") + "</p>";
    const notifications = [];
    const failures = [];
    for (const recipient of recipients) {
      try {
        await erpRequest("POST", "/api/resource/Notification%20Log", {
          type: "Alert",
          for_user: recipient,
          subject,
          email_content: content,
          document_type: "Task",
          document_name: task.name,
          from_user: session.erpUser,
        });
        notifications.push(recipient);
      } catch {
        failures.push(recipient);
      }
    }
    if (notifications.length) {
      await addTaskReply(request, task.name, { message: "Support Admin instructions sent to " + notifications.join(", ") + ":\n" + message });
    }
    return { success: failures.length === 0, notified: notifications.length, failed: failures.length, recipients: notifications };
  };
  // Assignment source of truth is the ERPNext Task _assign user list.
  const parseTaskAssignees = (raw) => {
    try {
      const list = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
      return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === "string" && x.trim()).map(trim))] : [];
    } catch { return []; }
  };
  const getTaskAssigneeNames = async (tasks) => {
    const ids = [...new Set(tasks.flatMap((task) => parseTaskAssignees(task._assign)))];
    const names = new Map();
    if (ids.length) {
      try {
        const users = await erpListAll("User", {
          fields: ["name", "full_name", "username"],
          filters: [["name", "in", ids]],
        });
        users.forEach((u) => names.set(u.name, trim(u.full_name) || trim(u.username) || u.name));
      } catch {
        // ERP user lookup may be permission-restricted; retain actual user IDs.
      }
    }
    return names;
  };
  const overview = async (request) => {
    const session = await requireSession(request);
    const supportedCustomers = session.isSupportAdmin ? await getSupportedCustomers() : [session.customer];
    const projects = await getAccessibleProjects(session, supportedCustomers);
    const projectByName = new Map(projects.map((project) => [project.name, project]));
    const projectNames = projects.map((p) => p.name);
    const tasks = await getTasks(projectNames);
    const taskAssigneeNames = await getTaskAssigneeNames(tasks);

    const taskCards = tasks.map((task) => ({
      id: task.name,
      erpTaskId: task.name,
      title: task.subject || task.name,
      stage: task.status || "Open",
      project: task.project || "",
      company: projectByName.get(task.project)?.custom_support_customer || session.customer,
      deadline: task.exp_end_date || null,
      remainingHours: 0,
      updatedAt: task.modified,
      description: task.description || "",
      priority: task.priority || "Medium",
      assignedUsers: parseTaskAssignees(task._assign),
      assignedTo: parseTaskAssignees(task._assign).map((id) => taskAssigneeNames.get(id) || id).join(", ") || "Unassigned",
      completedBy: /completed|closed/i.test(task.status || "") ? task.modified_by || "" : "",
      syncStatus: "ERPNext",
    }));

    const openTasks = taskCards.filter((task) => !/completed|closed|cancelled/i.test(task.stage));
    const projectCards = projects.map((project) => {
      const related = taskCards.filter((task) => task.project === project.name);
      const active = related.filter((task) => !/completed|closed|cancelled/i.test(task.stage)).length;
      return {
        id: project.name,
        title: project.project_name || project.name,
        company: project.custom_support_customer || session.customer,
        stage: project.status || "Open",
        owner: "ABiT Team",
        openTasks: active,
        totalTasks: related.length,
        inProgressTasks: related.filter((task) => /progress|pending|working/i.test(task.stage)).length,
        completedTasks: related.filter((task) => /completed|closed/i.test(task.stage)).length,
        blockedTasks: related.filter((task) => /blocked|hold/i.test(task.stage)).length,
        progress: Number(project.percent_complete || 0),
        erpProjectId: project.name,
      };
    });

    const tickets = openTasks.map((task) => ({
      id: task.id,
      title: task.title,
      stage: task.stage,
      state: task.stage,
      priority: task.priority,
      project: task.project,
      company: task.company,
      owner: task.assignedTo,
      updatedAt: task.updatedAt,
    }));

    const companies = supportedCustomers.map((name) => {
      const companyProjects = projectCards.filter((project) => project.company === name);
      const companyTasks = taskCards.filter((task) => task.company === name);
      return {
        name,
        projectCount: companyProjects.length,
        totalTasks: companyTasks.length,
        openTasks: companyTasks.filter((task) => /open|planned/i.test(task.stage)).length,
        inProgressTasks: companyTasks.filter((task) => /progress|pending|working/i.test(task.stage)).length,
        completedTasks: companyTasks.filter((task) => /completed|closed/i.test(task.stage)).length,
        blockedTasks: companyTasks.filter((task) => /blocked|hold/i.test(task.stage)).length,
        projects: companyProjects,
      };
    });
    return {
      summary: {
        openTickets: tickets.length,
        activeProjects: projects.length,
        activeTasks: openTasks.length,
        blockedItems: taskCards.filter((task) => /blocked|hold/i.test(task.stage)).length,
        totalTasks: taskCards.length,
        completedTasks: taskCards.filter((task) => /completed|closed/i.test(task.stage)).length,
        lastUpdated: new Date().toISOString(),
      },
      isSupportAdmin: session.isSupportAdmin,
      companies,
      tickets,
      projects: projectCards,
      tasks: taskCards,
      clientCode: session.customer,
      companyName: session.customer,
      login: session.login,
    };
  };

  const uploadAttachment = async (erpTaskId, attachment) => {
    const name = trim(attachment?.fileName);
    const contentBase64 = trim(attachment?.contentBase64);
    if (!name || !contentBase64) throw new Error("Attachment is missing a file name or content.");
    const bytes = Buffer.from(contentBase64, "base64");
    if (!bytes.length) throw new Error("Attachment is empty.");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Attachment exceeds the 10 MB limit.");

    const form = new FormData();
    form.append("doctype", "Task");
    form.append("docname", erpTaskId);
    form.append("is_private", "1");
    form.append("file", new Blob([bytes], { type: trim(attachment.contentType) || "application/octet-stream" }), name);

    const response = await fetch(baseUrl + "/api/method/upload_file", {
      method: "POST",
      headers: { ...adminHeaders },
      body: form,
    });
    await readJson(response);
  };

  const createTask = async (request, body) => {
    const session = await requireSession(request);
    if (session.isSupportAdmin) {
      const error = new Error("Support admins monitor tasks; create new tasks from the client workspace.");
      error.status = 403;
      throw error;
    }
    const subject = trim(body?.subject).slice(0, 180);
    const details = trim(body?.message ?? body?.details).slice(0, 10000);
    if (!subject || !details) {
      const error = new Error("Task subject and details are required.");
      error.status = 422;
      throw error;
    }

    const projects = await getAccessibleProjects(session);
    const requestedProject = trim(body?.projectId || body?.project || "");
    const project = requestedProject
      ? projects.find((item) => item.name === requestedProject)
      : projects[0];

    if (!project) {
      const error = new Error("No ERP project is assigned to this support customer.");
      error.status = 403;
      throw error;
    }

    const priority = priorityMap[String(body?.priority ?? "1")] || "Medium";
    const created = (await erpRequest("POST", "/api/resource/Task", {
      subject,
      description: details,
      project: project.name,
      status: "Open",
      priority,
    })).data;

    const attachments = Array.isArray(body?.attachments) ? body.attachments.slice(0, 5) : [];
    const attachmentErrors = [];
    let attachmentCount = 0;
    for (const attachment of attachments) {
      try {
        await uploadAttachment(created.name, attachment);
        attachmentCount += 1;
      } catch (error) {
        attachmentErrors.push((attachment?.fileName || "attachment") + ": " + error.message);
      }
    }

    return {
      success: true,
      task: {
        id: created.name,
        erpTaskId: created.name,
        title: created.subject || subject,
        stage: created.status || "Open",
        project: project.project_name || project.name,
        updatedAt: created.modified || new Date().toISOString(),
      },
      attachmentCount,
      attachmentErrors,
    };
  };

  return {
    enabled: true,
    login,
    overview,
    createTask,
    getTaskActivity,
    addTaskReply,
    notifyTaskAssignees,
    requireSession,
    // Official ERPNext reset page manages email links and password security.
    recoveryUrl: baseUrl + "/login#forgot",
    recoveryMessage: "Reset your ERPNext password on the official ERPNext page. Use the email address on your ERPNext User record, then return here to sign in.",
  };
}
