import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initEngagementExplorer } from "../src/engagementExplorer.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("delivery-path explorer retains four searchable, accessible outcomes", () => {
  assert.match(html, /data-engagement-explorer/);
  const tabs = [...html.matchAll(/role="tab"\s+id="engagement-tab-(\w+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/role="tabpanel"\s+id="engagement-panel-(\w+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs, ["stabilize", "modernize", "build", "automate"]);
  assert.deepEqual(panels, tabs);
  for (const key of tabs) {
    assert.match(html, new RegExp(`aria-controls="engagement-panel-${key}"`));
    assert.match(html, new RegExp(`aria-labelledby="engagement-tab-${key}"`));
  }
  assert.equal((html.match(/data-engagement-inquiry=/g) || []).length, 4);
  assert.equal((html.match(/class="skip-(?:link|to-content)"/g) || []).length, 1,
    "keyboard users should see one skip-navigation link");
});

function fakeElement(attributes = {}) {
  const events = {};
  return {
    attributes: { ...attributes }, hidden: false, tabIndex: 0, focused: false,
    value: "", dataset: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener(name, handler) { events[name] = handler; },
    fire(name, event = {}) { return events[name]?.(event); },
    focus() { this.focused = true; },
  };
}

test("tabs respond to mouse and wrap-around keyboard navigation", () => {
  const tabs = Array.from({ length: 4 }, (_, i) => fakeElement({ "aria-selected": i === 0 ? "true" : "false" }));
  const panels = tabs.map(() => fakeElement());
  const links = [];
  const root = { querySelectorAll(selector) {
    return selector === '[role="tab"]' ? tabs : selector === '[role="tabpanel"]' ? panels : links;
  }};
  initEngagementExplorer(root, { querySelector() { return null; } });
  assert.deepEqual(panels.map((panel) => panel.hidden), [false, true, true, true]);
  tabs[2].fire('click');
  assert.deepEqual(panels.map((panel) => panel.hidden), [true, true, false, true]);
  let prevented = false;
  tabs[2].fire('keydown', { key: 'End', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(tabs[3].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[3].focused, true);
  tabs[3].fire('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].tabIndex, 0);
  assert.equal(tabs[3].tabIndex, -1);
});

test("inquiry action prefills the contact form without deleting visitor input", () => {
  const tabs = [fakeElement({ "aria-selected": "true" })];
  const panels = [fakeElement()];
  const link = fakeElement();
  link.dataset = { engagementInquiry: "ERP stabilization", engagementService: "ERP implementation or optimization" };
  const subject = fakeElement();
  const message = fakeElement();
  const service = fakeElement();
  service.options = [{ value: "" }, { value: "ERP implementation or optimization" }];
  const form = { querySelector(selector) {
    if (selector.startsWith('input')) return subject;
    if (selector.startsWith('textarea')) return message;
    if (selector.startsWith('select')) return service;
    return null;
  }};
  const root = { querySelectorAll(selector) {
    if (selector === '[role="tab"]') return tabs;
    if (selector === '[role="tabpanel"]') return panels;
    return [link];
  }};
  initEngagementExplorer(root, { querySelector() { return form; } });
  link.fire('click');
  assert.equal(subject.value, "Project inquiry: ERP stabilization");
  assert.match(message.value, /erp stabilization/);
  assert.equal(service.value, "ERP implementation or optimization");
  message.value = "Our requirements are confidential.";
  link.fire('click');
  assert.equal(message.value, "Our requirements are confidential.");
});
