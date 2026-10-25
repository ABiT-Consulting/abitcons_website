import { renderSupportAdminDashboard, renderSupportClientDashboard, renderSupportSidebar, icon } from "./support-dashboard-ui.js";
const supportPortalHosts = new Set(["support.abitcons.com", "support.abit.ai"]);
const isDedicatedSupportHost = supportPortalHosts.has(window.location.hostname.toLowerCase());
if (isDedicatedSupportHost) {
  document.documentElement.classList.add("support-host");
}

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
  ["/api/support/signup", "/api/support-signup.php"],
  ["/api/support/forgot-password", "/api/support-forgot-password.php"],
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

  const trimmedBody = rawBody.trim();
  if (response.ok && trimmedBody && !trimmedBody.startsWith("{") && !trimmedBody.startsWith("[")) {
    throw new Error("Account server returned an invalid response.");
  }

  if (!response.ok) {
    const error = new Error(data.error || "Request could not be completed.");
    error.status = response.status;
    throw error;
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

const authNavLinks = {
  signin: Array.from(document.querySelectorAll('[data-auth-link="signin"]')),
  support: Array.from(document.querySelectorAll('[data-auth-link="support"]')),
};

const setAuthNavigation = (user = readStoredAuthUser()) => {
  const isSignedIn = Boolean(user?.sessionToken);
  authNavLinks.signin.forEach((link) => {
    link.hidden = isSignedIn;
  });
  authNavLinks.support.forEach((link) => {
    link.hidden = !isSignedIn;
  });
};

setAuthNavigation();

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
  const savedTheme = localStorage.getItem("abit-support-theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const applySupportTheme = (value) => {
    const theme = value === "light" || value === "dark" ? value :
      (systemDark.matches ? "dark" : "light");
    document.documentElement.dataset.supportTheme = theme;
    return theme;
  };
  applySupportTheme(savedTheme);
  const signedOutShell = supportPortal.querySelector("[data-support-signed-out]");
  const signedInShell = supportPortal.querySelector("[data-support-signed-in]");
  const loginForm = supportPortal.querySelector("[data-support-login-form]");
  const forgotPasswordButton = supportPortal.querySelector("[data-support-forgot-password]");
  const accessRequestForm = supportPortal.querySelector("[data-support-signup-form]");
  const accessRequestFeedback = supportPortal.querySelector("[data-support-signup-feedback]");
  const ticketForm = supportPortal.querySelector("[data-support-ticket-form]");
  const selectedFilesBox = supportPortal.querySelector("[data-support-selected-files]");
  const projectSelect = supportPortal.querySelector("[data-support-project-select]");
  const authStatus = supportPortal.querySelector("[data-auth-status]");
  const authFeedback = supportPortal.querySelector("[data-auth-feedback]");
  const logoutButton = supportPortal.querySelector("[data-auth-logout]");
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
  const supportTabButtons = Array.from(supportPortal.querySelectorAll("[data-support-tab]"));
  const supportViews = Array.from(supportPortal.querySelectorAll("[data-support-view]"));
  const taskFilterButtons = Array.from(supportPortal.querySelectorAll("[data-task-status]"));
  const taskFilterCounts = Array.from(supportPortal.querySelectorAll("[data-task-filter-count]"));
  const topToolbar = document.createElement("div");
  topToolbar.className = "support-premium-toolbar";
  topToolbar.innerHTML =
    '<div class="support-premium-toolbar__title"><strong>ABiT Support Portal</strong>' +
    '<span>Live ERPNext projects and support operations</span></div>' +
    '<div class="sp-toolbar-actions"><label class="support-premium-search">' + icon("search") +
    '<input type="search" placeholder="Search tasks or companies..." aria-label="Search tasks" data-premium-search></label>' +
    '<button type="button" class="support-theme-toggle" data-theme-toggle aria-label="Switch light and dark appearance">' +
    icon("moon") + '<span>Appearance</span></button>' +
    '<div class="sp-top-profile"><span class="sp-top-avatar">AB</span><span class="sp-top-name">Signed in</span></div></div>';
  supportPortal.querySelector(".support-app-content")?.prepend(topToolbar);
  topToolbar.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const theme = document.documentElement.dataset.supportTheme === "dark" ? "light" : "dark";
    localStorage.setItem("abit-support-theme", theme);
    applySupportTheme(theme);
  });
  topToolbar.querySelector("[data-premium-search]")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const rows = supportPortal.querySelectorAll(".sp-task-table tbody tr, [data-support-tasks] [data-task-card]");
    rows.forEach((row) => {
      row.hidden = Boolean(query && !row.textContent.toLowerCase().includes(query));
    });
  });
  const sidebarNav = supportPortal.querySelector(".support-app-nav");
  const navIcons = { dashboard:"home",tasks:"tasks","new-task":"plus",projects:"folder",account:"user" };
  sidebarNav?.querySelectorAll("[data-support-tab]").forEach((button) => {
    const first = button.querySelector("span");
    if (first) first.innerHTML=icon(navIcons[button.dataset.supportTab]||"tasks");
  });
  const sidebarLinks = document.createElement("div");
  sidebarLinks.className = "sp-sidebar-links";
  sidebarNav?.after(sidebarLinks);
  const sidebarFooter = supportPortal.querySelector(".support-app-sidebar__footer");
  if (sidebarFooter) sidebarFooter.innerHTML =
    '<div class="sp-help">'+icon("chat")+'<div><strong>Need help?</strong><small>ABiT support team</small></div></div>'+
    '<button type="button" class="sp-help-button" data-sidebar-request>Request support</button>';  const sidebarCompany = supportPortal.querySelector("[data-support-sidebar-company]");
  const sidebarUser = supportPortal.querySelector("[data-support-sidebar-user]");
  const supportRefreshMs = 60_000;
  let supportRefreshTimer = null;
  let isSupportLoading = false;
  let queuedSupportRefresh = false;
  let supportTasks = [];
  let activeTaskStatus = "all";

  const sanitizePortalText = (value) =>
    String(value ?? "")
      .replace(/odoo\s*bot/gi, "ABiT Team")
      .replace(/\bodoo\b/gi, "ERP");

  const escapeText = (value) =>
    sanitizePortalText(value)
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

  const formatActivityTime = (value) => {
    if (!value) return "";
    const normalized = String(value).includes("T") ? value : String(value).replace(" ", "T");
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
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

  const setAuthFeedback = (message, isError = false) => {
    if (!authFeedback) {
      return;
    }
    authFeedback.textContent = message;
    authFeedback.classList.toggle("is-error", isError);
  };

  const setAuthStatus = (message, isError = false) => {
    if (!authStatus) {
      return;
    }
    authStatus.textContent = message;
    authStatus.classList.toggle("is-error", isError);
  };

  const persistSupportUser = (user) => {
    if (user?.sessionToken) {
      localStorage.setItem(authStorageKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(authStorageKey);
    }
    setAuthNavigation(user);
    window.dispatchEvent(new CustomEvent("abit-auth-change", { detail: user || null }));
  };

  const setSupportVisibility = (isSignedIn) => {
    if (signedOutShell) signedOutShell.hidden = isSignedIn;
    if (signedInShell) signedInShell.hidden = !isSignedIn;
    document.documentElement.classList.toggle("support-authenticated", isSignedIn);
  };

  const supportWorkspaceHash = (clientCode) =>
    clientCode ? `#support-portal/${encodeURIComponent(clientCode)}` : "#support-portal";

  const syncSupportWorkspaceRoute = (user) => {
    const clientCode = String(user?.clientCode || "").trim();
    const expectedHash = supportWorkspaceHash(clientCode);
    const requestedCode = window.location.hash.startsWith("#support-portal/")
      ? decodeURIComponent(window.location.hash.slice("#support-portal/".length)).trim()
      : "";

    if (clientCode && requestedCode.toLowerCase() !== clientCode.toLowerCase()) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${expectedHash}`
      );
      return;
    }

    if (isDedicatedSupportHost && !window.location.hash.startsWith("#support-portal")) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${expectedHash}`
      );
    }
  };

  const activateSupportTab = (tabName = "dashboard") => {
    const validTab = supportViews.some((view) => view.dataset.supportView === tabName)
      ? tabName
      : "dashboard";
    supportTabButtons.forEach((button) => {
      const active = button.dataset.supportTab === validTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    supportViews.forEach((view) => {
      const active = view.dataset.supportView === validTab;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    if (isDedicatedSupportHost) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  supportTabButtons.forEach((button) => {
    button.addEventListener("click", () => activateSupportTab(button.dataset.supportTab));
  });

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

  const renderProjectOptions = (projects = []) => {
    if (!projectSelect) return;
    const current = projectSelect.value;
    projectSelect.innerHTML =
      '<option value="">Select project</option>' +
      projects
        .map((project) => '<option value="' + escapeText(project.erpProjectId || project.id) + '">' + escapeText(project.title || project.erpProjectId || project.id) + '</option>')
        .join("");
    const validCurrent = projects.some((project) => String(project.erpProjectId || project.id) === current);
    if (validCurrent) {
      projectSelect.value = current;
    } else if (projects.length === 1) {
      projectSelect.value = String(projects[0].erpProjectId || projects[0].id || "");
    }
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

  const cleanRichText = (value = "") => {
    const source = String(value || "");
    if (!source) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, "text/html");
    doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    doc.querySelectorAll("p, div, li, hr").forEach((node) => {
      if (node.tagName === "LI") node.prepend("Ã¢â‚¬Â¢ ");
      node.append("\n");
    });
    return (doc.body.textContent || "")
      .replace(/Migration Batch:[^\n]*/gi, "")
      .replace(/ERPTask ID:[^\n]*/gi, "")
      .replace(/ERPStage:[^\n]*/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const normalizeTaskStatus = (value = "") => {
    const status = String(value || "").trim().toLowerCase();
    if (["completed", "closed", "done"].includes(status)) return "completed";
    if (["in progress", "working", "pending", "started"].includes(status)) return "in-progress";
    if (["blocked", "on hold", "hold"].includes(status)) return "blocked";
    if (["cancelled", "canceled"].includes(status)) return "cancelled";
    return "open";
  };

  const updateTaskFilterCounts = () => {
    const counts = { all: supportTasks.length, open: 0, "in-progress": 0, completed: 0, blocked: 0, cancelled: 0 };
    supportTasks.forEach((task) => {
      const key = normalizeTaskStatus(task.stage);
      if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    });
    taskFilterCounts.forEach((node) => {
      const key = node.dataset.taskFilterCount;
      node.textContent = String(counts[key] ?? 0);
    });
  };

  const renderTaskThread = (container, data) => {
    if (!container) return;
    const task = data?.task || {};
    const activity = Array.isArray(data?.activity) ? data.activity : [];
    const expectedDue = task.expectedDueDate ? formatDate(task.expectedDueDate) : "Not set";

    const items = activity.length
      ? activity
          .map((item) => {
            const body = cleanRichText(item.content || "");
            const isEmail = item.type === "email" || item.type === "email-log";
            const label = isEmail
              ? ("Email" + (item.direction ? " Â· " + item.direction : ""))
              : (item.activityType || "Activity");
            return '<article class="support-thread-item ' + (isEmail ? "is-email" : "is-activity") + '">' +
              '<div class="support-thread-item__meta">' +
                '<span class="support-thread-kind">' + escapeText(label) + '</span>' +
                '<span>' + escapeText(item.author || "ABiT Team") + '</span>' +
                '<time>' + escapeText(formatActivityTime(item.date)) + '</time>' +
              '</div>' +
              (item.subject ? '<h5>' + escapeText(item.subject) + '</h5>' : '') +
              (body ? '<div class="support-thread-item__body">' + escapeText(body).replace(/\n/g, "<br>") + '</div>' : '') +
            '</article>';
          })
          .join("")
      : '<p class="support-empty">No activity has been recorded on this task yet.</p>';

    container.innerHTML =
      '<div class="support-thread-head">' +
        '<div><strong>Conversation &amp; activity</strong><span>Expected due: ' + escapeText(expectedDue) + '</span></div>' +
        '<span class="support-thread-status">' + escapeText(task.status || "") + '</span>' +
      '</div>' +
      '<div class="support-thread-list">' + items + '</div>' +
      '<form class="support-thread-reply" data-task-reply-form data-task-id="' + escapeText(task.id || "") + '">' +
        '<label>Reply to this task<textarea name="message" rows="3" maxlength="8000" placeholder="Write your update or reply. It will be saved in ERP activity." required></textarea></label>' +
        '<div class="support-thread-reply__actions">' +
          '<span data-task-reply-feedback></span>' +
          '<button class="btn primary" type="submit">Send reply</button>' +
        '</div>' +
      '</form>';
  };

  const loadTaskThread = async (taskId, container, { force = false } = {}) => {
    if (!container || !taskId) return;
    if (container.dataset.loaded === "true" && !force) return;
    container.innerHTML = '<p class="support-empty">Loading conversation...</p>';
    try {
      const data = await apiJsonRequest(
        "/api/support/tasks/" + encodeURIComponent(taskId) + "/activity",
        { auth: true }
      );
      renderTaskThread(container, data);
      container.dataset.loaded = "true";
    } catch (error) {
      container.innerHTML =
        '<p class="support-empty support-thread-error">' +
        escapeText(error instanceof Error ? error.message : "Conversation could not be loaded.") +
        '</p>';
    }
  };

  const renderTasks = (tasks = supportTasks) => {
    supportTasks = Array.isArray(tasks) ? tasks : [];
    updateTaskFilterCounts();
    const visibleTasks = activeTaskStatus === "all" ? supportTasks : supportTasks.filter((task) => normalizeTaskStatus(task.stage) === activeTaskStatus);
    if (taskCount) taskCount.textContent = String(visibleTasks.length);
    if (!tasksList) return;
    if (!visibleTasks.length) {
      const label = activeTaskStatus === "all" ? "active" : activeTaskStatus.replace("-", " ");
      tasksList.innerHTML = '<p class="support-empty">No ' + escapeText(label) + ' tasks found for this account.</p>';
      return;
    }
    tasksList.innerHTML = visibleTasks.map((task) => {
      const description = cleanRichText(task.description);
      const stage = task.stage || "Open";
      const taskId = task.erpTaskId || task.id;
      const dueText = task.deadline ? formatDate(task.deadline) : "Not set";
      return '<article class="support-item support-task-card" data-task-card="' + escapeText(taskId) + '">' +
        '<div class="support-task-card__top"><div>' +
        '<span class="support-task-card__eyebrow">' + escapeText(task.company ? task.company + " · " + (task.project || "") : (task.project || "Support task")) + '</span>' +
        '<h4>' + escapeText(cleanRichText(task.title) || task.title) + '</h4></div>' +
        '<span class="support-task-status">' + escapeText(stage) + '</span></div>' +
        itemMeta([["Expected due", dueText], ["ERP Task", taskId], ["Assigned to", task.assignedTo || "Unassigned"], ["Priority", task.priority || "Medium"]]) +
        (description ? '<div class="support-task-description">' + escapeText(description).replace(/\n/g, "<br>") + '</div>' : '') +
        '<div class="support-task-card__footer">' +
        (task.completedBy ? '<span>Completed by <strong>' + escapeText(task.completedBy) + '</strong></span>' : '<span>ERP-linked task</span>') +
        '<span>Updated ' + escapeText(formatDate(task.updatedAt) || "recently") + '</span></div>' +
        '<div class="support-task-card__actions">' +
          '<button class="support-thread-toggle" type="button" data-task-thread-toggle="' + escapeText(taskId) + '" aria-expanded="false">Conversation &amp; activity</button>' +
        '</div>' +
        '<section class="support-task-thread" data-task-thread="' + escapeText(taskId) + '" hidden></section>' +
      '</article>';
    }).join("");
  };

  tasksList?.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-task-thread-toggle]");
    if (!toggle) return;
    const taskId = toggle.dataset.taskThreadToggle;
    const card = toggle.closest("[data-task-card]");
    const thread = card?.querySelector("[data-task-thread]");
    if (!thread) return;
    const opening = thread.hidden;
    thread.hidden = !opening;
    toggle.setAttribute("aria-expanded", opening ? "true" : "false");
    toggle.textContent = opening ? "Hide conversation" : "Conversation & activity";
    if (opening) {
      await loadTaskThread(taskId, thread);
    }
  });

  tasksList?.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-task-reply-form]");
    if (!form) return;
    event.preventDefault();
    const taskId = form.dataset.taskId;
    const textarea = form.elements.message;
    const feedback = form.querySelector("[data-task-reply-feedback]");
    const submitButton = form.querySelector('button[type="submit"]');
    const message = textarea?.value?.trim() || "";
    if (!message) return;

    try {
      if (submitButton) submitButton.disabled = true;
      if (feedback) feedback.textContent = "Sending...";
      await apiJsonRequest(
        "/api/support/tasks/" + encodeURIComponent(taskId) + "/reply",
        { method: "POST", payload: { message }, auth: true }
      );
      if (textarea) textarea.value = "";
      if (feedback) feedback.textContent = "Reply saved to ERP activity.";
      const thread = form.closest("[data-task-thread]");
      if (thread) {
        thread.dataset.loaded = "false";
        await loadTaskThread(taskId, thread, { force: true });
      }
    } catch (error) {
      if (feedback) {
        feedback.textContent = error instanceof Error ? error.message : "Reply could not be saved.";
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  taskFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeTaskStatus = button.dataset.taskStatus || "all";
      taskFilterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderTasks(supportTasks);
    });
  });

  const clientOverviewPanel = document.createElement("div");
  clientOverviewPanel.className = "sp-client-dashboard";
  const clientDashboardView = supportPortal.querySelector('[data-support-view="dashboard"]');
  clientDashboardView?.querySelector(".support-dashboard-metrics")?.after(clientOverviewPanel);
  const renderClientOverview = (overview) => {
    const user = readStoredAuthUser();
    const isAdmin = Boolean(overview?.isSupportAdmin);
    clientOverviewPanel.hidden = isAdmin;
    clientDashboardView?.classList.toggle("sp-client-dashboard-ready", !isAdmin);
    if (!isAdmin) clientOverviewPanel.innerHTML = renderSupportClientDashboard(overview, user);
  };
  const openSupportTask = (taskId) => {
    if (!taskId) return;
    activeTaskStatus = "all";
    renderTasks(supportTasks);
    taskFilterButtons.forEach(b => b.classList.toggle("is-active", b.dataset.taskStatus === "all"));
    activateSupportTab("tasks");
    const card = Array.from(tasksList?.querySelectorAll("[data-task-card]") || [])
      .find(node => node.dataset.taskCard === String(taskId));
    if (card) {
      card.scrollIntoView({ behavior:"smooth", block:"start" });
      const toggle = card.querySelector("[data-task-thread-toggle]");
      if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
    }
  };
  clientOverviewPanel.addEventListener("click", (event) => {
    const target = event.target.closest("[data-admin-open-task]");
    if (target) { openSupportTask(target.dataset.adminOpenTask); return; }
    if (event.target.closest("[data-client-go-tasks]")) activateSupportTab("tasks");
    if (event.target.closest("[data-client-go-projects]")) activateSupportTab("projects");
  });
  sidebarLinks.addEventListener("click", (event) => {
    const company = event.target.closest("[data-select-company]");
    if (company) {
      activateSupportTab("dashboard");
      const filter = adminPanel.querySelector("[data-admin-company]");
      if (filter) { filter.value = company.dataset.selectCompany; filter.dispatchEvent(new Event("change",{bubbles:true})); }
      document.getElementById("sp-admin-tasks")?.scrollIntoView({ behavior:"smooth",block:"start" });
      return;
    }
    const action = event.target.closest("[data-client-go-projects], [data-sidebar-open-list]");
    if (action) activateSupportTab(action.dataset.sidebarOpenList || "projects");
  });
  sidebarFooter?.addEventListener("click", (event) => {
    if (event.target.closest("[data-sidebar-request]")) activateSupportTab(readStoredAuthUser()?.isSupportAdmin?"tasks":"new-task");
  });
  // Support Admin sees all support-enabled ERP companies, with project/status rollups.
  let adminTaskIds = null;
  const adminPanel = document.createElement("section");
  adminPanel.className = "support-admin-center";
  adminPanel.hidden = true;
  const dashboardView = supportPortal.querySelector('[data-support-view="dashboard"]');
  dashboardView?.append(adminPanel);

  const renderAdminOverview = (overview) => {
    if (!overview?.isSupportAdmin) {
      adminPanel.hidden = true;
      dashboardView?.classList.remove("is-admin-dashboard");
      adminTaskIds = null;
      return;
    }
    const tasks = Array.isArray(overview.tasks) ? overview.tasks : [];
    const incoming = adminTaskIds ? tasks.filter(task => !adminTaskIds.has(String(task.id))) : [];
    adminTaskIds = new Set(tasks.map(task => String(task.id)));
    adminPanel.hidden = false;
    dashboardView?.classList.add("is-admin-dashboard");
    const user = readStoredAuthUser();
    adminPanel.innerHTML = renderSupportAdminDashboard(overview, user);
    if (incoming.length) {
      const message = incoming.length + " new support task(s): " +
        incoming.slice(0,3).map(t => (t.company||"") + " - " + t.title).join("; ");
      const alert = adminPanel.querySelector("[data-admin-notice]");
      if (alert) { alert.hidden = false; alert.textContent = message; }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New ABiT support tasks", { body: message });
      }
    }
  };
  adminPanel.addEventListener("change", (event) => {
    if (!event.target.closest("[data-admin-company], [data-admin-status]")) return;
    const company = adminPanel.querySelector("[data-admin-company]")?.value || "";
    const status = adminPanel.querySelector("[data-admin-status]")?.value || "";
    adminPanel.querySelectorAll("[data-admin-task-company]").forEach((row) => {
      row.hidden = Boolean((company && row.dataset.adminTaskCompany !== company) ||
        (status && row.dataset.adminTaskStatus !== status));
    });
  });
  adminPanel.addEventListener("click", async (event) => {
    if (event.target.closest("[data-admin-notifications]")) {
      if ("Notification" in window) await Notification.requestPermission();
      return;
    }
    const company=event.target.closest("[data-select-company]");
    if (company) {
      const filter=adminPanel.querySelector("[data-admin-company]");
      if (filter) {
        filter.value=company.dataset.selectCompany;
        filter.dispatchEvent(new Event("change",{bubbles:true}));
      }
      document.getElementById("sp-admin-tasks")?.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    if(event.target.closest("[data-admin-scroll-tasks]")) {
      document.getElementById("sp-admin-tasks")?.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    const notifyButton=event.target.closest("[data-admin-notify-task]");
    if (notifyButton) {
      const message=window.prompt("Instructions for the assigned ERPNext user (saved in Task activity):");
      if (!message?.trim()) return;
      notifyButton.disabled=true;
      const notice=adminPanel.querySelector("[data-admin-notice]");
      try {
        const result=await apiJsonRequest("/api/support/admin/tasks/"+
          encodeURIComponent(notifyButton.dataset.adminNotifyTask)+"/notify",
          {method:"POST",payload:{message:message.trim()},auth:true});
        if (notice) {
          notice.hidden=false;
          notice.textContent=result.notified+" assigned ERP users notified"+
            (result.failed ? "; "+result.failed+" failed." : ".");
        }
      } catch(error) {
        if (notice) {notice.hidden=false;notice.textContent=error.message||"Notification failed.";}
      } finally {notifyButton.disabled=false;}
      return;
    }
    const task=event.target.closest("[data-admin-open-task]");
    if (task) openSupportTask(task.dataset.adminOpenTask);
  });  const renderSignedOut = () => {
    adminPanel.hidden = true;
    dashboardView?.classList.remove("is-admin-dashboard");
    clientDashboardView?.classList.remove("sp-client-dashboard-ready");
    clientOverviewPanel.hidden=true;
    sidebarLinks.innerHTML="";
    adminTaskIds = null;
    setSupportVisibility(false);
    if (userHeading) userHeading.textContent = "Sign in to view your workspace.";
    if (userCopy) {
      userCopy.textContent =
        "Use your ABiT-issued username and password to load your workspace.";
    }
    renderMetrics();
    renderTickets([]);
    renderProjects([]);
    renderTasks([]);
    setFormDisabled(true);
    setAlert("Sign in to load your support workspace.");
    setAuthStatus("Not signed in.");
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
    syncSupportWorkspaceRoute(user);
    setSupportVisibility(true);
    topToolbar.querySelector(".support-premium-toolbar__title strong").textContent = user.isSupportAdmin ? "Support Admin Center" : "Client Support Portal";
    const profile=topToolbar.querySelector(".sp-top-name");
    const avatar=topToolbar.querySelector(".sp-top-avatar");
    if(profile) profile.textContent = user.name || user.login || "Support";
    if(avatar) avatar.textContent = (user.name || user.login || "AB").trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||"").join("");
    const newTaskNav=supportPortal.querySelector('[data-support-tab="new-task"]');
    if(newTaskNav) newTaskNav.hidden=Boolean(user.isSupportAdmin);
    const eyebrow=supportPortal.querySelector(".support-app-identity .eyebrow");
    if(eyebrow) eyebrow.textContent=user.isSupportAdmin?"SUPPORT OPERATIONS":"CLIENT WORKSPACE";
    const workspaceName = user.company?.name || user.name || "Customer";
    const signedInName = user.login || user.email || user.name || "Customer";
    if (userHeading) userHeading.textContent = `${workspaceName} workspace`;
    if (userCopy) {
      userCopy.textContent = `Signed in as ${signedInName}. Your updates are synced securely.`;
    }
    if (sidebarCompany) sidebarCompany.textContent = workspaceName;
    if (sidebarUser) sidebarUser.textContent = `Signed in as ${signedInName}`;
    setAuthStatus(`Signed in as ${user.login || user.email || user.name}.`);
    setFormDisabled(Boolean(user.isSupportAdmin));
    if (!silent) {
      setAlert("Loading support workspace...");
    }

    try {
      const overview = await apiJsonRequest("/api/support/overview", { auth: true });
      renderAdminOverview(overview);
      renderClientOverview(overview);
      sidebarLinks.innerHTML=renderSupportSidebar(overview,Boolean(overview.isSupportAdmin));
      renderMetrics(overview.summary);
      renderTickets(overview.tickets);
      renderProjects(overview.projects);
      renderProjectOptions(overview.projects);
      renderTasks(overview.tasks);
      const updated = formatSyncTime(overview.summary?.lastUpdated);
      setAlert(`Workspace synced${updated ? ` ${updated}` : ""}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Support workspace could not be loaded.";
      setAlert(message, true);
      if (error?.status === 401) {
        persistSupportUser(null);
        renderSignedOut();
        setAuthFeedback("Your session expired. Sign in again.", true);
      }
    } finally {
      isSupportLoading = false;
      if (queuedSupportRefresh) {
        queuedSupportRefresh = false;
        loadSupportOverview({ silent: true });
      }
    }
  };

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const login = loginForm.elements.login?.value?.trim() || "";
    const password = loginForm.elements.password?.value || "";
    const submitButton = loginForm.querySelector('button[type="submit"]');

    if (!login || !password) {
      setAuthFeedback("Username and password are required.", true);
      return;
    }

    try {
      if (submitButton) submitButton.disabled = true;
      setAuthFeedback("");
      setAuthStatus("Signing in...");
      const { user } = await apiJsonRequest("/api/signin", {
        method: "POST",
        payload: { login, password },
      });
      if (!user?.sessionToken) {
        throw new Error("Sign-in response was invalid. Please contact ABiT support.");
      }
      persistSupportUser(user);
      syncSupportWorkspaceRoute(user);
      loginForm.reset();
      setAuthStatus(`Signed in as ${user.login || user.email || user.name}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign-in could not be completed. Please try again.";
      setAuthStatus("Not signed in.", true);
      setAuthFeedback(message, true);
      persistSupportUser(null);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  accessRequestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = accessRequestForm.querySelector('button[type="submit"]');
    const payload = {
      companyName: accessRequestForm.elements.companyName?.value?.trim() || "",
      contactName: accessRequestForm.elements.contactName?.value?.trim() || "",
      email: accessRequestForm.elements.email?.value?.trim() || "",
      phone: accessRequestForm.elements.phone?.value?.trim() || "",
      country: accessRequestForm.elements.country?.value?.trim() || "",
      services: accessRequestForm.elements.services?.value?.trim() || "",
      existingCustomerCode: accessRequestForm.elements.existingCustomerCode?.value?.trim() || "",
    };

    if (!payload.companyName || !payload.contactName || !payload.email) {
      if (accessRequestFeedback) {
        accessRequestFeedback.textContent = "Company, contact person, and email are required.";
        accessRequestFeedback.classList.add("is-error");
      }
      return;
    }

    try {
      if (submitButton) submitButton.disabled = true;
      if (accessRequestFeedback) {
        accessRequestFeedback.textContent = "Submitting access request...";
        accessRequestFeedback.classList.remove("is-error");
      }

      const result = await apiJsonRequest("/api/support/signup", {
        method: "POST",
        payload,
      });

      const requestId = result.request?.id ? ` Reference: ${result.request.id}.` : "";
      if (accessRequestFeedback) {
        accessRequestFeedback.textContent =
          (result.message ||
            "Access request received. ABiT will provision your portal user after verification.") +
          requestId;
        accessRequestFeedback.classList.remove("is-error");
      }
      accessRequestForm.reset();
    } catch (error) {
      if (accessRequestFeedback) {
        accessRequestFeedback.textContent =
          error instanceof Error ? error.message : "Access request could not be submitted.";
        accessRequestFeedback.classList.add("is-error");
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  forgotPasswordButton?.addEventListener("click", async () => {
    const login = loginForm?.elements.login?.value?.trim() || "";

    if (!login) {
      setAuthFeedback("Enter your username or registered email first.", true);
      loginForm?.elements.login?.focus();
      return;
    }

    try {
      forgotPasswordButton.disabled = true;
      setAuthFeedback("");
      setAuthStatus("Sending recovery instructions...");
      const { message } = await apiJsonRequest("/api/support/forgot-password", {
        method: "POST",
        payload: { login },
      });
      setAuthStatus("Not signed in.");
      setAuthFeedback(
        message ||
          "If this account is registered, recovery instructions were sent to the registered contact."
      );
    } catch (error) {
      setAuthStatus("Not signed in.", true);
      setAuthFeedback(
        error instanceof Error
          ? error.message
          : "Recovery instructions could not be sent. Please contact ABiT support.",
        true
      );
    } finally {
      forgotPasswordButton.disabled = false;
    }
  });

  ticketForm?.elements.attachments?.addEventListener("change", () => {
    const files = Array.from(ticketForm.elements.attachments.files || []);
    if (!selectedFilesBox) return;
    selectedFilesBox.hidden = files.length === 0;
    selectedFilesBox.innerHTML = files
      .map((file) => `<span>Ã°Å¸â€œÅ½ ${escapeText(file.name)} <small>${(file.size / 1024 / 1024).toFixed(1)} MB</small></span>`)
      .join("");
  });

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });

  ticketForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = readStoredAuthUser();
    if (!user?.sessionToken) {
      setAlert("Please sign in before creating a support ticket.", true);
      return;
    }

    const submitButton = ticketForm.querySelector('button[type="submit"]');
    const files = Array.from(ticketForm.elements.attachments?.files || []);
    if (files.length > 5) {
      setAlert("Please attach no more than 5 files.", true);
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setAlert("Each attachment must be 10 MB or smaller.", true);
      return;
    }

    const payload = {
      subject: ticketForm.elements.subject?.value?.trim() || "",
      priority: ticketForm.elements.priority?.value || "1",
      projectId: ticketForm.elements.projectId?.value || "",
      message: ticketForm.elements.message?.value?.trim() || "",
      attachments: await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          contentBase64: await fileToBase64(file),
        }))
      ),
    };

    if (!payload.subject || !payload.message) {
      setAlert("Ticket subject and details are required.", true);
      return;
    }

    try {
      if (submitButton) submitButton.disabled = true;
      setAlert("Creating support ticket...");
      const createResult = await apiJsonRequest("/api/support/tickets", {
        method: "POST",
        payload,
        auth: true,
      });
      ticketForm.reset();
      if (selectedFilesBox) {
        selectedFilesBox.hidden = true;
        selectedFilesBox.innerHTML = "";
      }
      setAlert("Support ticket created. Refreshing your workspace...");
      await loadSupportOverview();
      activateSupportTab("tasks");
      if (Array.isArray(createResult?.attachmentErrors) && createResult.attachmentErrors.length) {
        setAlert("Task created, but " + createResult.attachmentErrors.length + " attachment(s) could not be uploaded to ERPNext.", true);
      } else if (files.length) {
        setAlert("Task created with " + files.length + " attachment(s) in ERPNext.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Support ticket could not be created.", true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  logoutButton?.addEventListener("click", () => {
    persistSupportUser(null);
    clearSupportRefresh();
    renderSignedOut();
    setAuthFeedback("You have been signed out.");
  });

  window.addEventListener("abit-auth-change", () => {
    loadSupportOverview();
    startSupportRefresh();
  });

  window.addEventListener("hashchange", () => {
    const user = readStoredAuthUser();
    if (user?.sessionToken) {
      syncSupportWorkspaceRoute(user);
    } else if (isDedicatedSupportHost && !window.location.hash.startsWith("#support-portal")) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#support-portal`
      );
    }
  });

  if (isDedicatedSupportHost && !window.location.hash) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#support-portal`
    );
  }

  activateSupportTab("dashboard");

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadSupportOverview({ silent: true });
    }
  });

  loadSupportOverview();
  startSupportRefresh();
}

const heroPhotoShowcase = document.querySelector("[data-photo-showcase]");
if (heroPhotoShowcase) {
  const photoImage = heroPhotoShowcase.querySelector("[data-photo-image]");
  const quoteNode = heroPhotoShowcase.querySelector("[data-photo-title]");
  const autoRotateDelay = 60000;
  const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=3840&q=90`;

  const buildScenes = (quotes, photos) =>
    photos.map((photo, index) => ({
      quote: quotes[index % quotes.length],
      ...photo,
    }));

  const cosmosQuotes = [
    "Build with the patience of nature and the reach of the cosmos.",
    "Look farther than the brief; the strongest ideas arrive from deeper space.",
    "Scale begins when vision is bigger than the visible horizon.",
    "Every great platform starts as a signal in the dark.",
    "The future rewards teams that map new constellations.",
  ];
  const natureQuotes = [
    "Growth is quiet before it becomes visible; build the roots first.",
    "Nature scales through balance; systems should do the same.",
    "Durable progress is built like a forest: connected, resilient, alive.",
    "Let clarity move like water through every process.",
    "Strong foundations turn pressure into elevation.",
  ];
  const technologyQuotes = [
    "Turn signal into structure, and structure into momentum.",
    "The best platforms feel invisible because every team moves faster.",
    "Technology wins when it simplifies the work behind ambition.",
    "Build systems that think clearly when the business moves fast.",
    "Intelligence becomes useful when it reaches the workflow.",
  ];
  const businessQuotes = [
    "Great businesses align people, systems, and timing.",
    "Execution turns strategy into trust.",
    "A clear operating system gives every team more leverage.",
    "Better decisions compound faster than better intentions.",
    "When the workflow is clean, growth has room to move.",
  ];

  const cosmosPhotos = [
    {
      src: "https://www.nasa.gov/wp-content/uploads/2023/03/pillars_of_creation.jpg?w=3840",
      alt: "Hubble photograph of the Pillars of Creation in the Eagle Nebula",
    },
    { src: unsplash("photo-1462331940025-496dfbfc7564"), alt: "Deep space galaxy photograph" },
    { src: unsplash("photo-1446776811953-b23d57bd21aa"), alt: "Earth and space photography" },
    { src: unsplash("photo-1454789548928-9efd52dc4031"), alt: "Star field and cosmic dust photography" },
    { src: unsplash("photo-1465101162946-4377e57745c3"), alt: "Night sky full of stars" },
    { src: unsplash("photo-1464802686167-b939a6910659"), alt: "Milky Way galaxy night sky" },
    { src: unsplash("photo-1506318137071-a8e063b4bec0"), alt: "Cosmic sky and stars" },
    { src: unsplash("photo-1534796636912-3b95b3ab5986"), alt: "Milky Way above a natural horizon" },
    { src: unsplash("photo-1516339901601-2e1b62dc0c45"), alt: "Clear starry sky photography" },
    { src: unsplash("photo-1419242902214-272b3f66ee7a"), alt: "Space nebula and star photography" },
    { src: unsplash("photo-1538370965046-79c0d6907d47"), alt: "Astronomical sky photography" },
    { src: unsplash("photo-1543722530-d2c3201371e7"), alt: "Moon and night sky photography" },
    { src: unsplash("photo-1502134249126-9f3755a50d78"), alt: "Expansive cosmos and stars" },
  ];

  const naturePhotos = [
    { src: unsplash("photo-1500530855697-b586d89ba3ee"), alt: "Mountain lake landscape photography" },
    { src: unsplash("photo-1447752875215-b2761acb3c5d"), alt: "Dense forest nature photography" },
    { src: unsplash("photo-1470071459604-3b5ec3a7fe05"), alt: "Misty forest and mountain landscape" },
    { src: unsplash("photo-1506744038136-46273834b3fb"), alt: "Lake and mountain valley landscape" },
    { src: unsplash("photo-1469474968028-56623f02e42e"), alt: "Sunlit mountain nature scene" },
    { src: unsplash("photo-1433086966358-54859d0ed716"), alt: "Waterfall and lush nature photography" },
    { src: unsplash("photo-1470770841072-f978cf4d019e"), alt: "Blue mountain lake landscape" },
    { src: unsplash("photo-1500534314209-a25ddb2bd429"), alt: "Open desert and mountain landscape" },
    { src: unsplash("photo-1475924156734-496f6cac6ec1"), alt: "Golden natural landscape at sunset" },
    { src: unsplash("photo-1472214103451-9374bd1c798e"), alt: "Rolling green landscape photography" },
    { src: unsplash("photo-1493246507139-91e8fad9978e"), alt: "Forest path and natural greenery" },
    { src: unsplash("photo-1464822759023-fed622ff2c3b"), alt: "Snow mountain landscape photography" },
    { src: unsplash("photo-1483728642387-6c3bdd6c93e5"), alt: "Alpine mountain and lake photography" },
  ];

  const technologyPhotos = [
    { src: unsplash("photo-1518770660439-4636190af475"), alt: "Close-up circuit board technology photograph" },
    { src: unsplash("photo-1558494949-ef010cbdcc31"), alt: "Modern data center technology photography" },
    { src: unsplash("photo-1485827404703-89b55fcc595e"), alt: "Advanced robotics technology photography" },
    { src: unsplash("photo-1516116216624-53e697fedbea"), alt: "Futuristic technology infrastructure" },
    { src: unsplash("photo-1550751827-4bd374c3f58b"), alt: "Computer hardware and circuit technology" },
    { src: unsplash("photo-1451187580459-43490279c0fa"), alt: "Global network and digital technology" },
    { src: unsplash("photo-1535223289827-42f1e9919769"), alt: "Immersive virtual reality technology" },
    { src: unsplash("photo-1516321318423-f06f85e504b3"), alt: "Laptop technology in a modern workspace" },
    { src: unsplash("photo-1504384308090-c894fdcc538d"), alt: "Server and cloud infrastructure photography" },
    { src: unsplash("photo-1519389950473-47ba0277781c"), alt: "Development team working with technology" },
    { src: unsplash("photo-1498050108023-c5249f4df085"), alt: "Software code on a development screen" },
    { src: unsplash("photo-1531297484001-80022131f5a1"), alt: "Modern laptop technology close-up" },
  ];

  const businessPhotos = [
    { src: unsplash("photo-1507679799987-c73779587ccf"), alt: "Business professional in a modern city" },
    { src: unsplash("photo-1556761175-b413da4baf72"), alt: "Business team collaborating in a meeting" },
    { src: unsplash("photo-1552664730-d307ca884978"), alt: "Business team planning a project together" },
    { src: unsplash("photo-1521737604893-d14cc237f11d"), alt: "Business collaboration in a modern office" },
    { src: unsplash("photo-1517048676732-d65bc937f952"), alt: "Team discussion around a business table" },
    { src: unsplash("photo-1551836022-d5d88e9218df"), alt: "Business people working together" },
    { src: unsplash("photo-1520607162513-77705c0f0d4a"), alt: "Business architecture and corporate skyline" },
    { src: unsplash("photo-1486406146926-c627a92ad1ab"), alt: "Modern business skyscraper architecture" },
    { src: unsplash("photo-1497366811353-6870744d04b2"), alt: "Bright modern business office" },
    { src: unsplash("photo-1556761175-4b46a572b786"), alt: "Business meeting with documents and laptops" },
    { src: unsplash("photo-1556761175-5973dc0f32e7"), alt: "Professional business team in discussion" },
    { src: unsplash("photo-1556761175-129418cb2dfe"), alt: "Business strategy meeting photography" },
  ];

  const photoScenes = [
    ...buildScenes(cosmosQuotes, cosmosPhotos),
    ...buildScenes(natureQuotes, naturePhotos),
    ...buildScenes(technologyQuotes, technologyPhotos),
    ...buildScenes(businessQuotes, businessPhotos),
  ];

  let previousSceneIndex = -1;
  let sceneOrder = [];
  let autoRotateTimer = 0;
  let transitionToken = 0;
  let preloadImage = null;

  const shuffleSceneOrder = () => {
    sceneOrder = photoScenes.map((_, index) => index);
    for (let index = sceneOrder.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [sceneOrder[index], sceneOrder[randomIndex]] = [sceneOrder[randomIndex], sceneOrder[index]];
    }
    if (sceneOrder[0] === previousSceneIndex && sceneOrder.length > 1) {
      [sceneOrder[0], sceneOrder[1]] = [sceneOrder[1], sceneOrder[0]];
    }
  };

  const choosePhotoScene = () => {
    if (sceneOrder.length === 0) {
      shuffleSceneOrder();
    }

    previousSceneIndex = sceneOrder.shift() ?? 0;
    return photoScenes[previousSceneIndex];
  };

  const preloadUpcomingPhoto = () => {
    if (sceneOrder.length === 0 || !("Image" in window)) {
      return;
    }

    const upcomingScene = photoScenes[sceneOrder[0]];
    preloadImage = new Image();
    preloadImage.src = upcomingScene.src;
  };

  const applyPhotoScene = (scene = choosePhotoScene()) => {
    if (quoteNode) {
      quoteNode.textContent = scene.quote;
    }
    if (!(photoImage instanceof HTMLImageElement)) {
      return;
    }

    const currentTransition = (transitionToken += 1);
    photoImage.classList.add("is-changing");
    const nextImage = new Image();
    nextImage.decoding = "async";
    nextImage.onload = () => {
      if (currentTransition !== transitionToken) {
        return;
      }
      photoImage.src = scene.src;
      photoImage.alt = scene.alt;
      window.requestAnimationFrame(() => {
        photoImage.classList.remove("is-changing");
      });
      preloadUpcomingPhoto();
    };
    nextImage.onerror = () => {
      if (currentTransition === transitionToken) {
        photoImage.classList.remove("is-changing");
      }
    };
    nextImage.src = scene.src;
  };

  const scheduleAutoRotate = () => {
    window.clearTimeout(autoRotateTimer);
    autoRotateTimer = window.setTimeout(() => {
      applyPhotoScene();
      scheduleAutoRotate();
    }, autoRotateDelay);
  };

  const advancePhoto = () => {
    applyPhotoScene();
    scheduleAutoRotate();
  };

  heroPhotoShowcase.addEventListener("click", advancePhoto);
  heroPhotoShowcase.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    advancePhoto();
  });
  applyPhotoScene();
  scheduleAutoRotate();
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
