/**
 * Accessible, progressive enhancement for the ABiT delivery-path explorer.
 * All panel copy is static HTML so search engines and no-JS readers retain it.
 */
export function initEngagementExplorer(root, page = document) {
  if (!root) return null;

  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  if (!tabs.length || tabs.length !== panels.length) return null;

  const activate = (index, focus = false) => {
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[tabIndex].hidden = !active;
    });
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => {
      const keys = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!Object.hasOwn(keys, event.key)) return;
      event.preventDefault();
      activate(keys[event.key], true);
    });
  });

  for (const link of root.querySelectorAll('[data-engagement-inquiry]')) {
    link.addEventListener('click', () => {
      const form = page.querySelector('.contact-form');
      if (!form) return;
      const subject = form.querySelector('input[name="subject"]');
      const message = form.querySelector('textarea[name="message"]');
      const service = form.querySelector('select[name="service"]');
      const topic = link.dataset.engagementInquiry || '';
      const requestedService = link.dataset.engagementService || '';

      // Respect anything the visitor has already entered.
      if (subject && !subject.value.trim() && topic) {
        subject.value = `Project inquiry: ${topic}`;
      }
      if (message && !message.value.trim() && topic) {
        message.value = `We would like to discuss ${topic.toLowerCase()} for our business. Please share an approach and next steps.`;
      }
      if (service && !service.value &&
          [...service.options].some((option) => option.value === requestedService)) {
        service.value = requestedService;
      }
    });
  }

  activate(Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')));
  return { activate };
}
