import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const window = new Window({ url: "http://homeassistant.local/" });
const timers = new Set();
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (callback, delay, ...args) => {
  const timer = nativeSetTimeout((...callbackArgs) => { timers.delete(timer); callback(...callbackArgs); }, delay, ...args);
  timers.add(timer); return timer;
};
globalThis.clearTimeout = (timer) => { timers.delete(timer); nativeClearTimeout(timer); };
Object.assign(globalThis, {
  window, document: window.document, HTMLElement: window.HTMLElement, customElements: window.customElements,
  CustomEvent: window.CustomEvent, location: window.location, requestAnimationFrame: (callback) => setTimeout(callback, 0),
  ResizeObserver: class { observe() {} disconnect() {} },
});
await import("../src/index.js");
after(async () => {
  for (const timer of timers) nativeClearTimeout(timer);
  timers.clear(); await window.happyDOM.abort();
  globalThis.setTimeout = nativeSetTimeout; globalThis.clearTimeout = nativeClearTimeout;
});

const states = {
  "sensor.cpu": { entity_id: "sensor.cpu", state: "12", attributes: { friendly_name: "Processor", unit_of_measurement: "%", icon: "mdi:cpu-64-bit" } },
  "sensor.ram": { entity_id: "sensor.ram", state: "46", attributes: { friendly_name: "Memory", unit_of_measurement: "%" } },
  "sensor.ip": { entity_id: "sensor.ip", state: "192.168.4.204", attributes: { friendly_name: "LAN IP", icon: "mdi:network" } },
  "sensor.status": { entity_id: "sensor.status", state: "online", attributes: { friendly_name: "Server status" } },
};

function config(overrides = {}) {
  return {
    layout: "two-row", show_icons: true, refresh_interval: 3600,
    metrics: [
      { entity: "sensor.cpu", name: "CPU", color: "#65b7e8", min: 0, max: 100 },
      { entity: "sensor.ram", name: "RAM", color: "#b09be9", min: 0, max: 100 },
    ],
    details: [
      { entity: "sensor.ip", icon: "mdi:network", show_icon: true },
      { entity: "sensor.status", icon: "mdi:circle", show_icon: true, state_colors: { online: "green" } },
    ],
    ...overrides,
  };
}

const history = (entityIds) => Object.fromEntries(entityIds.map((entityId, entityIndex) => [entityId, Array.from({ length: 12 }, (_, index) => ({ s: String(10 + entityIndex * 20 + index), lu: (Date.now() - (11 - index) * 300000) / 1000 }))]));

test("registers card metadata once and renders independent background sparklines", async () => {
  await import("../src/index.js");
  assert.equal(window.customCards.filter((card) => card.type === "compact-system-status-card").length, 1);
  const calls = [];
  const card = document.createElement("compact-system-status-card");
  card.setConfig(config());
  card.hass = { states, connection: { connected: true }, locale: { language: "en" }, callWS: async (message) => { calls.push(message); return history(message.entity_ids); } };
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].entity_ids, ["sensor.cpu", "sensor.ram"]);
  assert.equal(card.shadowRoot.querySelectorAll(".metric").length, 2);
  assert.equal(card.shadowRoot.querySelectorAll(".graph path").length, 4);
  assert.match(card.shadowRoot.textContent, /CPU12%/);
  assert.match(card.shadowRoot.textContent, /192\.168\.4\.204/);
  assert.equal(card.shadowRoot.querySelector(".dot").style.getPropertyValue("--detail-color"), "");
  assert.match(card.shadowRoot.querySelector(".detail:last-child").getAttribute("style"), /green/);
  card.remove();
});

test("updates current values without fetching history on every hass assignment", async () => {
  let calls = 0;
  const card = document.createElement("compact-system-status-card");
  card.setConfig(config());
  card.hass = { states, connection: { connected: true }, locale: { language: "en" }, callWS: async ({ entity_ids }) => { calls++; return history(entity_ids); } };
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 15));
  card.hass = { ...card._hass, states: { ...states, "sensor.cpu": { ...states["sensor.cpu"], state: "88" } } };
  assert.match(card.shadowRoot.textContent, /CPU88%/);
  assert.equal(calls, 1);
  card.remove();
  const generation = card._generation;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(card._generation, generation);
});

test("supports missing history, unavailable values, single-row mode and more-info keyboard interaction", async () => {
  const card = document.createElement("compact-system-status-card");
  card.setConfig(config({ layout: "single-row", title: "NAS", show_title: true }));
  card.hass = { states: { ...states, "sensor.cpu": { ...states["sensor.cpu"], state: "unavailable" } }, connection: { connected: true }, callWS: async () => ({}) };
  let selected;
  card.addEventListener("hass-more-info", (event) => { selected = event.detail.entityId; });
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(card.shadowRoot.querySelector("ha-card").className, "single-row");
  assert.equal(card.shadowRoot.querySelector(".title").textContent, "NAS");
  assert.match(card.shadowRoot.textContent, /unavailable/i);
  const metric = card.shadowRoot.querySelector(".metric");
  metric.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(selected, "sensor.cpu");
  assert.match(card.shadowRoot.querySelector("style").textContent, /@container \(max-width:600px\)/);
  card.remove();
});

test("provides an editor with entity pickers and card sizing", async () => {
  const editor = await customElements.get("compact-system-status-card").getConfigElement();
  editor.hass = { states };
  editor.setConfig(config());
  assert.equal(editor.shadowRoot.querySelectorAll("ha-entity-picker").length, 4);
  const card = document.createElement("compact-system-status-card");
  card.setConfig(config());
  assert.equal(card.getCardSize(), 2);
  assert.deepEqual(card.getGridOptions(), { columns: 12, rows: "auto", min_columns: 3, min_rows: 1 });
  assert.match(card.shadowRoot.querySelector("style").textContent, /inset:2px 4px 0/);
  assert.match(card.shadowRoot.querySelector("style").textContent, /width:100%; height:auto/);
  card.setConfig(config({ layout: "single-row", title: "NAS", show_title: true }));
  assert.equal(card.getCardSize(), 2);
});
