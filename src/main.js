import "./style.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || "";

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

const setNavState = (isOpen) => {
  if (!header || !navToggle) {
    return;
  }
  header.classList.toggle("nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
};

navToggle?.addEventListener("click", () => {
  const isOpen = header?.classList.contains("nav-open");
  setNavState(!isOpen);
});

navMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setNavState(false));
});

const updateHeader = () => {
  if (!header) {
    return;
  }
  header.classList.toggle("is-scrolled", window.scrollY > 24);
};

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

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
  const tabs = Array.from(authPanel.querySelectorAll("[data-auth-tab]"));
  const forms = Array.from(authPanel.querySelectorAll("[data-auth-form]"));
  const feedback = authPanel.querySelector("[data-auth-feedback]");
  const authStatus = authPanel.querySelector("[data-auth-status]");
  const logoutButton = authPanel.querySelector("[data-auth-logout]");
  const socialButtons = Array.from(authPanel.querySelectorAll("[data-social-provider]"));

  const storageKey = "abit-auth-user";

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
      localStorage.setItem(storageKey, JSON.stringify(user));
      setAuthStatus(`Signed in as ${user.name || user.email || "authenticated user"}`);
      if (logoutButton) {
        logoutButton.hidden = false;
      }
    } else {
      localStorage.removeItem(storageKey);
      setAuthStatus("Not signed in");
      if (logoutButton) {
        logoutButton.hidden = true;
      }
    }
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

  const storedUsers = JSON.parse(localStorage.getItem("abit-auth-users") || "[]");
  let users = Array.isArray(storedUsers) ? storedUsers : [];

  const upsertSocialUser = (socialUser) => {
    const existingIndex = users.findIndex((user) => user.email === socialUser.email);
    if (existingIndex > -1) {
      users[existingIndex] = { ...users[existingIndex], ...socialUser };
    } else {
      users = [...users, socialUser];
    }
    localStorage.setItem("abit-auth-users", JSON.stringify(users));
  };

  const completeSocialAuth = (payload, intent = "signup") => {
    if (!payload?.email) {
      setFeedback("Social authentication failed. Please try again.", true);
      return;
    }

    const socialUser = {
      name: payload.name,
      email: payload.email,
      provider: payload.provider,
      googleSub: payload.googleSub,
    };

    upsertSocialUser(socialUser);
    persistUser(socialUser);
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
            completeSocialAuth(
              {
                provider: "Google",
                email: profile.email,
                name: profile.name,
                googleSub: profile.sub,
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
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const email = form.elements.email?.value?.trim().toLowerCase() ?? "";
      const password = form.elements.password?.value ?? "";

      if (!email || !password) {
        setFeedback("Email and password are required.", true);
        return;
      }

      if (form.dataset.authForm === "signup") {
        const name = form.elements.name?.value?.trim() ?? "";
        const confirmPassword = form.elements.confirmPassword?.value ?? "";

        if (password !== confirmPassword) {
          setFeedback("Passwords do not match. Please try again.", true);
          return;
        }

        if (users.some((user) => user.email === email)) {
          setFeedback("This email is already registered. Please sign in.", true);
          return;
        }

        const newUser = { name, email, password, provider: "Email" };
        users = [...users, newUser];
        localStorage.setItem("abit-auth-users", JSON.stringify(users));
        persistUser(newUser);
        setFeedback("Sign-up successful. Your account is ready.");
        form.reset();
        return;
      }

      const user = users.find((item) => item.email === email && item.password === password);
      if (!user) {
        setFeedback("Invalid credentials. Please try again.", true);
        return;
      }

      persistUser(user);
      setFeedback("Signed in successfully. Welcome back.");
      form.reset();
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

  const activeUser = JSON.parse(localStorage.getItem(storageKey) || "null");
  persistUser(activeUser);
  setAuthMode("signup");
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
}
