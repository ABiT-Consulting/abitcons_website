import "./style.css";

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

const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  const captchaSlot = contactForm.querySelector("[data-math-captcha]");
  const captchaA = captchaSlot?.querySelector("[data-captcha-a]");
  const captchaB = captchaSlot?.querySelector("[data-captcha-b]");
  const captchaInput = captchaSlot?.querySelector("[data-captcha-input]");
  const captchaHint = captchaSlot?.querySelector("[data-captcha-hint]");
  const captchaRefresh = captchaSlot?.querySelector("[data-captcha-refresh]");
  const submitButton = contactForm.querySelector('button[type="submit"]');

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

  contactForm.addEventListener("submit", (event) => {
    updateCaptchaVisibility();
    if (!captchaSlot || captchaSlot.hidden) {
      return;
    }
    if (!isSolved) {
      event.preventDefault();
      setHint("Please solve the verification question.", true);
      captchaInput?.focus();
    }
  });

  updateCaptchaVisibility();
}
