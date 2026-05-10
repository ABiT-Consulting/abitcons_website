import "./style.css";

const rawGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
const isPlaceholderGoogleId =
  !rawGoogleClientId ||
  rawGoogleClientId === "your-google-client-id.apps.googleusercontent.com" ||
  !rawGoogleClientId.endsWith(".apps.googleusercontent.com");
const googleClientId = isPlaceholderGoogleId ? "" : rawGoogleClientId;
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || "";
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "";
const apiBaseUrl = configuredApiBaseUrl;
const authStorageKey = "abit-auth-user";
const phpApiFallbackRoutes = new Map([
  ["/api/health", "/api/health.php"],
  ["/api/register", "/api/register.php"],
  ["/api/signin", "/api/signin.php"],
  ["/api/social-auth", "/api/social-auth.php"],
  ["/api/support/overview", "/api/support-overview.php"],
  ["/api/support/tickets", "/api/support-ticket.php"],
]);

const readStoredAuthUser = () => {
  try {
    return JSON.parse(localStorage.getItem(authStorageKey) || "null");
  } catch {
    localStorage.removeItem(authStorageKey);
    return null;
  }
};

const getStoredAuthToken = () => readStoredAuthUser()?.sessionToken || "";

const parseApiResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text().catch(() => "");
  let data = {};

  if (contentType.includes("application/json") || rawBody.trim().startsWith("{")) {
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = {};
    }
  }

  return { data, rawBody };
};

const shouldTryPhpApiFallback = (path, response, rawBody) => {
  if (configuredApiBaseUrl || !import.meta.env.PROD || response.status !== 404) {
    return false;
  }

  if (!phpApiFallbackRoutes.has(path)) {
    return false;
  }

  return !rawBody.trim().startsWith("{");
};

const apiJsonRequest = async (path, { method = "GET", payload = null, auth = false } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getStoredAuthToken();
    if (!token) {
      throw new Error("Please sign in to continue.");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const requestOptions = {
    method,
    headers,
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  };

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, requestOptions);
  } catch {
    throw new Error("Account server is unavailable. Please start the backend server.");
  }

  let { data, rawBody } = await parseApiResponse(response);
  if (shouldTryPhpApiFallback(path, response, rawBody)) {
    const fallbackPath = phpApiFallbackRoutes.get(path);
    response = await fetch(`${apiBaseUrl}${fallbackPath}`, requestOptions);
    ({ data, rawBody } = await parseApiResponse(response));
  }

  if (!response.ok) {
    throw new Error(data.error || "Request could not be completed.");
  }

  return data;
};

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.head.appendChild(script);
  });

const initGa4 = () => {
  if (!gaMeasurementId) {
    return;
  }

  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`)
    .then(() => {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

      window.gtag("js", new Date());
      window.gtag("config", gaMeasurementId, { send_page_view: false });

      const trackPageView = () => {
        window.gtag("event", "page_view", {
          page_location: window.location.href,
          page_path: `${window.location.pathname}${window.location.hash || ""}`,
          page_title: document.title,
        });
      };

      trackPageView();
      window.addEventListener("hashchange", trackPageView);
    })
    .catch(() => {
      // Analytics is optional; fail silently for users.
    });
};

initGa4();

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");
const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));

const setNavState = (isOpen) => {
  if (!header || !navToggle) {
    return;
  }
  header.classList.toggle("nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("nav-is-open", isOpen);
};

navToggle?.addEventListener("click", () => {
  const isOpen = header?.classList.contains("nav-open");
  setNavState(!isOpen);
});

navMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setNavState(false));
});

document.addEventListener("pointerdown", (event) => {
  if (!header?.classList.contains("nav-open")) {
    return;
  }

  const target = event.target;
  if (target instanceof Node && header.contains(target)) {
    return;
  }

  setNavState(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setNavState(false);
  }
});

const updateHeader = () => {
  if (!header) {
    return;
  }
  header.classList.toggle("is-scrolled", window.scrollY > 24);
};

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const sectionTargets = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && sectionTargets.length) {
  const setActiveNavLink = (id) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const navObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry?.target?.id) {
        setActiveNavLink(visibleEntry.target.id);
      }
    },
    {
      threshold: [0.18, 0.32, 0.55],
      rootMargin: "-22% 0px -58% 0px",
    }
  );

  sectionTargets.forEach((section) => navObserver.observe(section));
}

const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
  );

  revealElements.forEach((el) => observer.observe(el));
} else {
  revealElements.forEach((el) => el.classList.add("is-visible"));
}

const videoModal = document.querySelector("[data-video-modal]");
if (videoModal) {
  const videoFrame = videoModal.querySelector("[data-video-modal-iframe]");
  const videoTitle = videoModal.querySelector("[data-video-modal-title]");
  const closeButtons = Array.from(videoModal.querySelectorAll("[data-video-modal-close]"));
  const triggers = Array.from(document.querySelectorAll("[data-product-video]"));

  let lastActiveElement = null;

  const closeVideoModal = () => {
    if (!videoFrame) {
      return;
    }

    videoModal.classList.remove("is-open");
    videoModal.hidden = true;
    document.body.classList.remove("video-modal-open");
    videoFrame.setAttribute("src", "");

    if (lastActiveElement instanceof HTMLElement) {
      lastActiveElement.focus();
    }
  };

  const openVideoModal = (trigger) => {
    const url = trigger.dataset.videoUrl;
    if (!url || !videoFrame) {
      return;
    }

    lastActiveElement = document.activeElement;
    if (videoTitle) {
      videoTitle.textContent = trigger.dataset.videoTitle || "Product video";
    }

    videoFrame.setAttribute("src", url);
    videoModal.hidden = false;
    document.body.classList.add("video-modal-open");

    requestAnimationFrame(() => {
      videoModal.classList.add("is-open");
      closeButtons[0]?.focus();
    });
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => openVideoModal(trigger));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeVideoModal);
  });

  videoModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.hasAttribute("data-video-modal-close")) {
      closeVideoModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !videoModal.hidden) {
      closeVideoModal();
    }
  });
}

const authPanel = document.querySelector("[data-auth-panel]");
if (authPanel) {
  // Hide social-auth section if no providers are configured (prevents
  // visitors hitting Google's "invalid_client" error popup in production).
  const facebookConfigured = false; // not wired up yet
  if (!googleClientId) {
    const googleBtn = authPanel.querySelector('[data-social-provider="google"]');
    if (googleBtn) googleBtn.hidden = true;
  }
  if (!facebookConfigured) {
    const fbBtn = authPanel.querySelector('[data-social-provider="facebook"]');
    if (fbBtn) fbBtn.hidden = true;
  }
  if (!googleClientId && !facebookConfigured) {
    const divider = authPanel.querySelector(".auth-divider");
    const social = authPanel.querySelector(".social-auth");
    if (divider) divider.hidden = true;
    if (social) social.hidden = true;
  }

  const tabs = Array.from(authPanel.querySelectorAll("[data-auth-tab]"));
  const forms = Array.from(authPanel.querySelectorAll("[data-auth-form]"));
  const feedback = authPanel.querySelector("[data-auth-feedback]");
  const authStatus = authPanel.querySelector("[data-auth-status]");
  const logoutButton = authPanel.querySelector("[data-auth-logout]");
  const socialButtons = Array.from(authPanel.querySelectorAll("[data-social-provider]"));

  let googleTokenClient = null;
  let googleClientReady = false;
  let googleClientLoading = null;

  const setFeedback = (message, isError = false) => {
    if (!feedback) {
      return;
    }
    feedback.textContent = message;
    feedback.classList.toggle("is-error", isError);
  };

  const setAuthStatus = (message = "Not signed in") => {
    if (authStatus) {
      authStatus.textContent = message;
    }
  };

  const persistUser = (user) => {
    if (user) {
      localStorage.setItem(authStorageKey, JSON.stringify(user));
      setAuthStatus(`Signed in as ${user.name || user.email || "authenticated user"}`);
      if (logoutButton) {
        logoutButton.hidden = false;
      }
    } else {
      localStorage.removeItem(authStorageKey);
      setAuthStatus("Not signed in");
      if (logoutButton) {
        logoutButton.hidden = true;
      }
    }

    window.dispatchEvent(new CustomEvent("abit-auth-change", { detail: user || null }));
  };

  const setAuthMode = (mode) => {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.authTab === mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    forms.forEach((form) => {
      const isActive = form.dataset.authForm === mode;
      form.hidden = !isActive;
    });

    socialButtons.forEach((button) => {
      button.dataset.authIntent = mode;
    });

    setFeedback("");
  };

  const getErrorMessage = (error, fallback) =>
    error instanceof Error && error.message ? error.message : fallback;

  const apiRequest = async (path, payload) => {
    return apiJsonRequest(path, { method: "POST", payload });
  };

  const completeSocialAuth = async (payload, intent = "signup") => {
    if (!payload?.email) {
      setFeedback("Social authentication failed. Please try again.", true);
      return;
    }

    const { user } = await apiRequest("/api/social-auth", {
      name: payload.name,
      email: payload.email,
      provider: payload.provider,
      googleSub: payload.googleSub,
      accessToken: payload.accessToken,
    });

    persistUser(user);
    const modeLabel = intent === "signin" ? "Sign-in" : "Sign-up";
    setFeedback(`${modeLabel} with ${payload.provider} completed successfully.`);
    if (window.location.hash !== "#account-access") {
      window.location.hash = "#account-access";
    }
  };

  const ensureGoogleClient = () => {
    if (!googleClientId) {
      return Promise.reject(
        new Error("Google sign-in is not configured yet. Please add VITE_GOOGLE_CLIENT_ID.")
      );
    }

    if (googleClientReady && googleTokenClient) {
      return Promise.resolve();
    }

    if (googleClientLoading) {
      return googleClientLoading;
    }

    googleClientLoading = loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        if (!window.google?.accounts?.oauth2) {
          throw new Error("Google authentication SDK failed to initialize.");
        }

        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "openid profile email",
          callback: () => {},
          error_callback: (error) => {
            const details = error?.message || error?.type || "Google login was cancelled.";
            setFeedback(`Google sign-in failed: ${details}`, true);
          },
        });

        googleClientReady = true;
      })
      .finally(() => {
        googleClientLoading = null;
      });

    return googleClientLoading;
  };

  const fetchGoogleProfile = async (accessToken) => {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Unable to read your Google profile.");
    }

    return response.json();
  };

  const providerLogin = async (provider, intent = "signup") => {
    if (provider !== "google") {
      setFeedback("Facebook login is not configured in this environment yet.", true);
      return;
    }

    try {
      await ensureGoogleClient();

      await new Promise((resolve, reject) => {
        googleTokenClient.callback = async (tokenResponse) => {
          if (tokenResponse?.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          try {
            const profile = await fetchGoogleProfile(tokenResponse.access_token);
            await completeSocialAuth(
              {
                provider: "Google",
                email: profile.email,
                name: profile.name,
                googleSub: profile.sub,
                accessToken: tokenResponse.access_token,
              },
              intent
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        googleTokenClient.requestAccessToken({ prompt: "select_account" });
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Google sign-in could not be completed. Please try again.";
      setFeedback(message, true);
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setAuthMode(tab.dataset.authTab);
    });
  });

  forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = form.elements.email?.value?.trim().toLowerCase() ?? "";
      const password = form.elements.password?.value ?? "";
      const submitButton = form.querySelector('button[type="submit"]');

      if (!email || !password) {
        setFeedback("Email and password are required.", true);
        return;
      }

      if (form.dataset.authForm === "signup") {
        const name = form.elements.name?.value?.trim() ?? "";
        const companyName = form.elements.companyName?.value?.trim() ?? "";
        const industry = form.elements.industry?.value?.trim() ?? "";
        const companySize = form.elements.companySize?.value?.trim() ?? "";
        const companyWebsite = form.elements.companyWebsite?.value?.trim() ?? "";
        const confirmPassword = form.elements.confirmPassword?.value ?? "";

        if (!name || !companyName || !industry) {
          setFeedback("Full name, company name, and industry are required.", true);
          return;
        }

        if (password !== confirmPassword) {
          setFeedback("Passwords do not match. Please try again.", true);
          return;
        }

        if (submitButton) {
          submitButton.disabled = true;
        }

        try {
          const { user } = await apiRequest("/api/register", {
            name,
            email,
            password,
            company: {
              name: companyName,
              industry,
              size: companySize,
              website: companyWebsite,
            },
          });

          persistUser(user);
          setFeedback(`Sign-up successful. ${companyName} is registered under ${industry}.`);
          form.reset();
        } catch (error) {
          setFeedback(
            getErrorMessage(error, "Registration could not be completed. Please try again."),
            true
          );
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
          }
        }

        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const { user } = await apiRequest("/api/signin", { email, password });
        persistUser(user);
        setFeedback("Signed in successfully. Welcome back.");
        form.reset();
      } catch (error) {
        setFeedback(getErrorMessage(error, "Sign-in could not be completed. Please try again."), true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  });

  socialButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.socialProvider;
      if (!provider) {
        setFeedback("Unsupported provider selected.", true);
        return;
      }
      const intent = button.dataset.authIntent || "signup";
      providerLogin(provider, intent);
    });
  });

  logoutButton?.addEventListener("click", () => {
    persistUser(null);
    setFeedback("You have been signed out.");
  });

  let activeUser = null;
  activeUser = readStoredAuthUser();
  persistUser(activeUser);
  setAuthMode("signup");
}

const supportPortal = document.querySelector("[data-support-portal]");
if (supportPortal) {
  const ticketForm = supportPortal.querySelector("[data-support-ticket-form]");
  const alertBox = supportPortal.querySelector("[data-support-alert]");
  const userHeading = supportPortal.querySelector("[data-support-user]");
  const userCopy = supportPortal.querySelector("[data-support-copy]");
  const metrics = supportPortal.querySelector("[data-support-metrics]");
  const ticketsList = supportPortal.querySelector("[data-support-tickets]");
  const projectsList = supportPortal.querySelector("[data-support-projects]");
  const tasksList = supportPortal.querySelector("[data-support-tasks]");
  const ticketCount = supportPortal.querySelector("[data-support-ticket-count]");
  const projectCount = supportPortal.querySelector("[data-support-project-count]");
  const taskCount = supportPortal.querySelector("[data-support-task-count]");
  const supportRefreshMs = 60_000;
  let supportRefreshTimer = null;
  let isSupportLoading = false;
  let queuedSupportRefresh = false;

  const escapeText = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const formatDate = (value) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatSyncTime = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const setAlert = (message, isError = false) => {
    if (!alertBox) {
      return;
    }
    alertBox.textContent = message;
    alertBox.classList.toggle("is-error", isError);
  };

  const setFormDisabled = (disabled) => {
    ticketForm
      ?.querySelectorAll("input, select, textarea, button")
      .forEach((field) => {
        field.disabled = disabled;
      });
  };

  const renderMetrics = (summary = {}) => {
    if (!metrics) {
      return;
    }
    const items = [
      ["Open tickets", summary.openTickets ?? "-"],
      ["Active projects", summary.activeProjects ?? "-"],
      ["Open tasks", summary.activeTasks ?? "-"],
      ["Blocked items", summary.blockedItems ?? "-"],
    ];
    metrics.innerHTML = items
      .map(
        ([label, value]) =>
          `<div><strong>${escapeText(value)}</strong><span>${escapeText(label)}</span></div>`
      )
      .join("");
  };

  const itemMeta = (items) =>
    `<div class="support-meta">${items
      .filter(Boolean)
      .map(([label, value, variant = ""]) => {
        const className = variant ? ` support-pill--${variant}` : "";
        return `<span class="support-pill${className}">${escapeText(label)}: ${escapeText(value)}</span>`;
      })
      .join("")}</div>`;

  const renderTickets = (tickets = []) => {
    if (ticketCount) ticketCount.textContent = String(tickets.length);
    if (!ticketsList) return;
    if (!tickets.length) {
      ticketsList.innerHTML = '<p class="support-empty">No support tickets found for this account.</p>';
      return;
    }

    ticketsList.innerHTML = tickets
      .map((ticket) => {
        const isUrgent = /urgent|high/i.test(ticket.priority || "");
        const isBlocked = /blocked/i.test(ticket.state || "");
        return `<article class="support-item">
          <h4>${escapeText(ticket.title)}</h4>
          ${itemMeta([
            ["Stage", ticket.stage],
            ["State", ticket.state, isBlocked ? "blocked" : ""],
            ["Priority", ticket.priority, isUrgent ? "urgent" : ""],
            ticket.project ? ["Project", ticket.project] : null,
          ])}
          <p>Owner: ${escapeText(ticket.owner || "ABiT Team")}</p>
          <p>Updated ${escapeText(formatDate(ticket.updatedAt) || "recently")}</p>
        </article>`;
      })
      .join("");
  };

  const renderProjects = (projects = []) => {
    if (projectCount) projectCount.textContent = String(projects.length);
    if (!projectsList) return;
    if (!projects.length) {
      projectsList.innerHTML = '<p class="support-empty">No active projects found for this account.</p>';
      return;
    }

    projectsList.innerHTML = projects
      .map(
        (project) => `<article class="support-item">
          <h4>${escapeText(project.title)}</h4>
          ${itemMeta([
            ["Stage", project.stage],
            ["Owner", project.owner],
            ["Open tasks", project.openTasks],
          ])}
          <div class="support-progress" aria-label="${escapeText(project.progress)}% complete">
            <span style="--value: ${Number(project.progress || 0)}%"></span>
          </div>
          <p>${escapeText(project.progress || 0)}% complete</p>
        </article>`
      )
      .join("");
  };

  const renderTasks = (tasks = []) => {
    if (taskCount) taskCount.textContent = String(tasks.length);
    if (!tasksList) return;
    if (!tasks.length) {
      tasksList.innerHTML = '<p class="support-empty">No active tasks found for this account.</p>';
      return;
    }

    tasksList.innerHTML = tasks
      .map(
        (task) => `<article class="support-item">
          <h4>${escapeText(task.title)}</h4>
          ${itemMeta([
            ["Stage", task.stage],
            task.project ? ["Project", task.project] : null,
            task.deadline ? ["Deadline", formatDate(task.deadline)] : null,
            ["Remaining", `${Number(task.remainingHours || 0).toFixed(1)}h`],
          ])}
          <p>Updated ${escapeText(formatDate(task.updatedAt) || "recently")}</p>
        </article>`
      )
      .join("");
  };

  const renderSignedOut = () => {
    if (userHeading) userHeading.textContent = "Sign in to view your workspace.";
    if (userCopy) {
      userCopy.textContent =
        "Use the customer account above to load your support tickets, active project status, and assigned delivery tasks.";
    }
    renderMetrics();
    renderTickets([]);
    renderProjects([]);
    renderTasks([]);
    setFormDisabled(true);
    setAlert("Sign in to load your Odoo support workspace.");
  };

  const clearSupportRefresh = () => {
    if (supportRefreshTimer) {
      window.clearInterval(supportRefreshTimer);
      supportRefreshTimer = null;
    }
  };

  const startSupportRefresh = () => {
    clearSupportRefresh();
    const user = readStoredAuthUser();
    if (!user?.sessionToken) {
      return;
    }

    supportRefreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        loadSupportOverview({ silent: true });
      }
    }, supportRefreshMs);
  };

  const loadSupportOverview = async ({ silent = false } = {}) => {
    const user = readStoredAuthUser();
    if (!user?.sessionToken) {
      clearSupportRefresh();
      renderSignedOut();
      return;
    }

    if (isSupportLoading) {
      queuedSupportRefresh = true;
      return;
    }

    isSupportLoading = true;
    if (userHeading) userHeading.textContent = `${user.company?.name || user.name || "Customer"} workspace`;
    if (userCopy) {
      userCopy.textContent = `Signed in as ${user.email}. Your updates are synced from Odoo.`;
    }
    setFormDisabled(false);
    if (!silent) {
      setAlert("Loading support workspace from Odoo...");
    }

    try {
      const overview = await apiJsonRequest("/api/support/overview", { auth: true });
      renderMetrics(overview.summary);
      renderTickets(overview.tickets);
      renderProjects(overview.projects);
      renderTasks(overview.tasks);
      const updated = formatSyncTime(overview.summary?.lastUpdated);
      setAlert(`Workspace synced${updated ? ` ${updated}` : ""}.`);
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Support workspace could not be loaded.", true);
    } finally {
      isSupportLoading = false;
      if (queuedSupportRefresh) {
        queuedSupportRefresh = false;
        loadSupportOverview({ silent: true });
      }
    }
  };

  ticketForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = readStoredAuthUser();
    if (!user?.sessionToken) {
      setAlert("Please sign in before creating a support ticket.", true);
      return;
    }

    const submitButton = ticketForm.querySelector('button[type="submit"]');
    const payload = {
      subject: ticketForm.elements.subject?.value?.trim() || "",
      priority: ticketForm.elements.priority?.value || "1",
      message: ticketForm.elements.message?.value?.trim() || "",
    };

    if (!payload.subject || !payload.message) {
      setAlert("Ticket subject and details are required.", true);
      return;
    }

    try {
      if (submitButton) submitButton.disabled = true;
      setAlert("Creating support ticket in Odoo...");
      await apiJsonRequest("/api/support/tickets", {
        method: "POST",
        payload,
        auth: true,
      });
      ticketForm.reset();
      setAlert("Support ticket created. Refreshing your workspace...");
      await loadSupportOverview();
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Support ticket could not be created.", true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  window.addEventListener("abit-auth-change", () => {
    loadSupportOverview();
    startSupportRefresh();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadSupportOverview({ silent: true });
    }
  });

  loadSupportOverview();
  startSupportRefresh();
}

const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  const captchaSlot = contactForm.querySelector("[data-math-captcha]");
  const captchaA = captchaSlot?.querySelector("[data-captcha-a]");
  const captchaB = captchaSlot?.querySelector("[data-captcha-b]");
  const captchaInput = captchaSlot?.querySelector("[data-captcha-input]");
  const captchaHint = captchaSlot?.querySelector("[data-captcha-hint]");
  const captchaRefresh = captchaSlot?.querySelector("[data-captcha-refresh]");
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const formNote = contactForm.querySelector("[data-form-note]");
  const contactSubject = contactForm.querySelector('input[name="subject"]');
  const contactMessage = contactForm.querySelector('textarea[name="message"]');

  const watchedFields = Array.from(contactForm.querySelectorAll("input, textarea")).filter(
    (field) => field !== captchaInput && field.type !== "submit" && field.type !== "button"
  );

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  let expectedAnswer = null;
  let isSolved = false;

  const setHint = (message, isError = false) => {
    if (!captchaHint) {
      return;
    }
    captchaHint.textContent = message;
    captchaHint.classList.toggle("is-error", isError);
  };

  const setFormNote = (message, isError = false) => {
    if (!formNote) {
      return;
    }
    formNote.textContent = message;
    formNote.classList.toggle("is-error", isError);
  };

  const updateSubmitState = () => {
    if (!submitButton || !captchaSlot) {
      return;
    }
    submitButton.disabled = !captchaSlot.hidden && !isSolved;
  };

  const generateCaptcha = () => {
    if (!captchaA || !captchaB || !captchaInput) {
      return;
    }
    const a = rand(2, 9);
    const b = rand(2, 9);
    expectedAnswer = a + b;
    isSolved = false;
    captchaA.textContent = String(a);
    captchaB.textContent = String(b);
    captchaInput.value = "";
    captchaInput.setAttribute("aria-invalid", "false");
    setHint("", false);
    updateSubmitState();
  };

  const validateCaptcha = () => {
    if (!captchaInput) {
      return;
    }

    const raw = captchaInput.value.trim();
    const value = Number.parseInt(raw, 10);

    if (!raw) {
      isSolved = false;
      captchaInput.setAttribute("aria-invalid", "false");
      setHint("", false);
      updateSubmitState();
      return;
    }

    if (!Number.isFinite(value) || expectedAnswer === null) {
      isSolved = false;
      captchaInput.setAttribute("aria-invalid", "true");
      setHint("Numbers only.", true);
      updateSubmitState();
      return;
    }

    if (value === expectedAnswer) {
      isSolved = true;
      captchaInput.setAttribute("aria-invalid", "false");
      setHint("Verified.", false);
    } else {
      isSolved = false;
      captchaInput.setAttribute("aria-invalid", "true");
      setHint("Incorrect. Try again or click New.", true);
    }

    updateSubmitState();
  };

  const updateCaptchaVisibility = () => {
    if (!captchaSlot || !captchaInput) {
      return;
    }

    const hasUserInput = watchedFields.some((field) => field.value.trim().length > 0);
    if (hasUserInput) {
      if (captchaSlot.hidden) {
        captchaSlot.hidden = false;
        captchaInput.disabled = false;
        generateCaptcha();
      }
    } else {
      captchaSlot.hidden = true;
      captchaInput.disabled = true;
      captchaInput.value = "";
      expectedAnswer = null;
      isSolved = false;
      setHint("", false);
    }

    updateSubmitState();
  };

  watchedFields.forEach((field) => field.addEventListener("input", updateCaptchaVisibility));
  captchaInput?.addEventListener("input", validateCaptcha);
  captchaRefresh?.addEventListener("click", () => {
    generateCaptcha();
    captchaInput?.focus();
  });

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateCaptchaVisibility();
    if ((captchaSlot && !captchaSlot.hidden) && !isSolved) {
      setHint("Please solve the verification question.", true);
      captchaInput?.focus();
      setFormNote("Please complete verification first.", true);
      return;
    }

    const endpoint = contactForm.getAttribute("action");
    if (!endpoint || !submitButton) {
      return;
    }

    try {
      submitButton.disabled = true;
      setFormNote("Sending message...", false);

      const formData = new FormData(contactForm);
      formData.append("_subject", formData.get("subject") || "New contact inquiry");
      formData.append("_template", "table");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Submit failed");
      }

      const payload = await response.json().catch(() => null);
      const isAccepted = payload?.success === true;
      if (!isAccepted) {
        const reason =
          payload?.message ||
          "Request was received but delivery is not active yet. Please verify mailbox first.";
        throw new Error(reason);
      }

      contactForm.reset();
      captchaSlot.hidden = true;
      captchaInput?.setAttribute("aria-invalid", "false");
      expectedAnswer = null;
      isSolved = false;
      setHint("", false);
      setFormNote("Message accepted. Please check inbox and spam.", false);
      updateSubmitState();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to send right now. Please try again in a moment.";
      setFormNote(message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  updateCaptchaVisibility();

  Array.from(document.querySelectorAll('.product-card .product-cta[href="#contact"]')).forEach(
    (link) => {
      link.addEventListener("click", () => {
        const card = link.closest(".product-card");
        const productName = card?.querySelector("h3")?.textContent?.trim() || "ABiT product";
        if (contactSubject instanceof HTMLInputElement) {
          contactSubject.value = `Demo request: ${productName}`;
        }
        if (contactMessage instanceof HTMLTextAreaElement) {
          contactMessage.value = `I would like to schedule a demo for ${productName}. Please share availability, pricing, and implementation details.`;
        }
        updateCaptchaVisibility();
        setFormNote(`Demo request prepared for ${productName}.`, false);

        window.setTimeout(() => {
          contactSubject?.focus({ preventScroll: true });
        }, 450);
      });
    }
  );
}
