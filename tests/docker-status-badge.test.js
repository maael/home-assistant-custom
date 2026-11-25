import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const window = new Window({ url: "http://homeassistant.local/dashboard" });
Object.assign(globalThis, {
  window, document: window.document, HTMLElement: window.HTMLElement, customElements: window.customElements,
  CustomEvent: window.CustomEvent, Event: window.Event, location: window.location,
});
await import("../src/index.js");
after(async () => window.happyDOM.abort());

const state = (value) => ({ state: String(value), attributes: {} });
const config = {
  total_entity: "sensor.total",
  updates_entity: "sensor.updates",
  errors_entity: "sensor.errors",
};

function createBadge(states, extra = {}) {
  const badge = document.createElement("docker-status-badge");
  badge.setConfig({ ...config, ...extra });
  badge.hass = { states, callService() {} };
  document.body.append(badge);
  return badge;
}

test("registers badge metadata once and renders the compact default content", () => {
  assert.equal(window.customBadges.filter((badge) => badge.type === "docker-status-badge").length, 1);
  const badge = createBadge({ "sensor.total": state(42), "sensor.updates": state(5), "sensor.errors": state(2) });
  const root = badge.shadowRoot.querySelector("ha-badge");
  assert.equal(root.getAttribute("type"), "button");
  assert.equal(badge.shadowRoot.querySelector(".primary-icon").getAttribute("icon"), "mdi:docker");
  assert.equal(badge.shadowRoot.querySelector(".primary-icon").style.color, "");
  assert.equal(badge.shadowRoot.querySelector(".total .count").textContent, "42");
  assert.equal(badge.shadowRoot.querySelector(".updates ha-icon").getAttribute("icon"), "mdi:package-up");
  assert.equal(badge.shadowRoot.querySelector(".updates .count").textContent, "5");
  assert.equal(badge.shadowRoot.querySelector(".errors .count").textContent, "2");
  assert.equal(badge.shadowRoot.querySelectorAll(".separator").length, 1);
  assert.equal(badge.shadowRoot.querySelector(".up_to_date"), null);
  assert.equal(root.getAttribute("aria-label"), "Docker: 42 monitored containers, 5 updates available, 2 errors");
  assert.match(root.style.getPropertyValue("--docker-primary-color"), /#2496ed/);
  badge.remove();
});

test("updates reactively and renders zero, unavailable, missing and invalid states correctly", () => {
  const badge = createBadge({ "sensor.total": state(1), "sensor.updates": state(0), "sensor.errors": state(0) });
  assert.equal(badge.shadowRoot.querySelector(".updates .count").textContent, "0");
  assert.match(badge.shadowRoot.querySelector(".updates").style.getPropertyValue("--metric-color"), /--green-color/);

  badge.hass = { states: { "sensor.total": state("unknown"), "sensor.updates": state("bad"), "sensor.errors": state("unavailable") } };
  assert.equal(badge.shadowRoot.querySelector(".total .count").textContent, "—");
  assert.equal(badge.shadowRoot.querySelector(".updates .count").textContent, "—");
  assert.equal(badge.shadowRoot.querySelector(".errors .count").textContent, "—");
  assert.match(badge.shadowRoot.querySelector(".updates").style.getPropertyValue("--metric-color"), /--grey-color/);
  assert.match(badge.shadowRoot.querySelector("ha-badge").style.getPropertyValue("--docker-primary-color"), /--grey-color/);

  badge.hass = { states: { "sensor.total": state(3), "sensor.updates": state(1) } };
  assert.equal(badge.shadowRoot.querySelector(".errors .count").textContent, "—");
  badge.remove();
});

test("hides zero metrics independently, shows health only when valid, and avoids empty separators", () => {
  const badge = createBadge(
    { "sensor.total": state(42), "sensor.updates": state(0), "sensor.errors": state(0) },
    { show_zero_updates: false, show_zero_errors: false, show_healthy_indicator: true },
  );
  assert.equal(badge.shadowRoot.querySelector(".updates"), null);
  assert.equal(badge.shadowRoot.querySelector(".errors"), null);
  assert.equal(badge.shadowRoot.querySelector(".healthy ha-icon").getAttribute("icon"), "mdi:check-circle-outline");
  assert.equal(badge.shadowRoot.querySelectorAll(".separator").length, 1);

  badge.hass = { states: { "sensor.total": state(42), "sensor.updates": state("unknown"), "sensor.errors": state(0) } };
  assert.equal(badge.shadowRoot.querySelector(".healthy"), null);
  assert.equal(badge.shadowRoot.querySelector(".updates .count").textContent, "—");

  badge.setConfig({ total_entity: "sensor.total", show_icon: false });
  badge.hass = { states: { "sensor.total": state(42) } };
  assert.equal(badge.shadowRoot.querySelector(".separator"), null);
  assert.equal(badge.shadowRoot.querySelector(".total .count").textContent, "42");
  badge.remove();
});

test("supports optional metrics, custom icons and colours", () => {
  const badge = createBadge(
    { "sensor.updates": state(4), "sensor.errors": state(0), "sensor.current": state(12) },
    {
      total_entity: undefined, up_to_date_entity: "sensor.current", show_total: false, show_up_to_date: true,
      icon: "mdi:cube", icon_color: "var(--docker-blue)", updates_icon: "mdi:arrow-up", updates_color: "#ff00aa",
    },
  );
  assert.equal(badge.shadowRoot.querySelector(".total"), null);
  assert.equal(badge.shadowRoot.querySelector(".primary-icon").getAttribute("icon"), "mdi:cube");
  assert.equal(badge.shadowRoot.querySelector(".updates ha-icon").getAttribute("icon"), "mdi:arrow-up");
  assert.equal(badge.shadowRoot.querySelector(".updates").style.getPropertyValue("--metric-color"), "#ff00aa");
  assert.equal(badge.shadowRoot.querySelector(".up_to_date .count").textContent, "12");
  badge.remove();
});

test("runs more-info, perform-action and keyboard interactions for the whole badge", () => {
  const calls = [];
  const badge = createBadge(
    { "sensor.total": state(42), "sensor.updates": state(5), "sensor.errors": state(2) },
    { tap_action: { action: "more-info", entity: "sensor.updates" } },
  );
  badge.hass = { states: badge._hass.states, callService: (...args) => calls.push(args) };
  let moreInfo;
  badge.addEventListener("hass-more-info", (event) => { moreInfo = event.detail.entityId; });
  const root = badge.shadowRoot.querySelector("ha-badge");
  root.click();
  assert.equal(moreInfo, "sensor.updates");
  root.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(moreInfo, "sensor.updates");

  badge._performAction({ action: "perform-action", perform_action: "homeassistant.toggle", data: { source: "badge" }, target: { entity_id: "switch.test" } });
  assert.deepEqual(calls, [["homeassistant", "toggle", { source: "badge" }, { entity_id: "switch.test" }]]);

  let opened;
  const originalOpen = window.open;
  window.open = (path) => { opened = path; };
  badge._performAction({ action: "url", url_path: "https://example.com/docker" });
  assert.equal(opened, "https://example.com/docker");
  window.open = originalOpen;

  let navigated = false;
  window.addEventListener("location-changed", () => { navigated = true; }, { once: true });
  badge._performAction({ action: "navigate", navigation_path: "/docker" });
  assert.equal(window.location.pathname, "/docker");
  assert.equal(navigated, true);
  badge.remove();
});

test("distinguishes double-tap and hold actions from a normal tap", async () => {
  const calls = [];
  const badge = createBadge(
    { "sensor.total": state(42), "sensor.updates": state(5), "sensor.errors": state(2) },
    {
      tap_action: { action: "more-info", entity: "sensor.total" },
      double_tap_action: { action: "more-info", entity: "sensor.errors" },
      hold_action: { action: "perform-action", perform_action: "script.docker_details" },
    },
  );
  badge.hass = { states: badge._hass.states, callService: (...args) => calls.push(args) };
  const info = [];
  badge.addEventListener("hass-more-info", (event) => info.push(event.detail.entityId));
  let root = badge.shadowRoot.querySelector("ha-badge");
  root.click(); root.click();
  assert.deepEqual(info, ["sensor.errors"]);
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.deepEqual(info, ["sensor.errors"]);

  root.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 520));
  root.dispatchEvent(new window.Event("pointerup", { bubbles: true }));
  root.click();
  assert.deepEqual(calls, [["script", "docker_details", {}, undefined]]);
  badge.remove();
});

test("provides a grouped editor with pickers, visibility, colours and actions", async () => {
  const editor = await customElements.get("docker-status-badge").getConfigElement();
  editor.hass = { states: {} };
  editor.setConfig({ ...config, updates_color: "purple", show_zero_updates: false, tap_action: { action: "url", url_path: "https://example.com" } });
  assert.equal(editor.shadowRoot.querySelectorAll("section").length, 4);
  assert.equal(editor.shadowRoot.querySelectorAll("ha-entity-picker").length >= 7, true);
  assert.equal(editor.shadowRoot.querySelectorAll("ha-icon-picker").length, 5);
  assert.equal(editor.shadowRoot.querySelector('[data-key="updates_color"]').value, "purple");
  assert.equal(editor.shadowRoot.querySelector('[data-key="show_zero_updates"]').checked, false);
  assert.equal(editor.shadowRoot.querySelector('[data-key="tap_action.action"]').value, "url");
  assert.equal(editor.shadowRoot.querySelector('[data-key="tap_action.url_path"]').value, "https://example.com");

  let changed;
  editor.addEventListener("config-changed", (event) => { changed = event.detail.config; });
  const toggle = editor.shadowRoot.querySelector('[data-key="show_up_to_date"]');
  toggle.checked = true;
  toggle.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(changed.show_up_to_date, true);
});
