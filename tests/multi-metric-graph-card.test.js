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
  "sensor.download": { state: "54.25", attributes: { friendly_name: "Download speed", unit_of_measurement: "Mbit/s", icon: "mdi:download" } },
  "sensor.upload": { state: "18.4", attributes: { friendly_name: "Upload speed", unit_of_measurement: "Mbit/s", icon: "mdi:upload" } },
  "sensor.ping": { state: "7", attributes: { friendly_name: "Ping", unit_of_measurement: "ms" } },
};

const config = (overrides = {}) => ({
  columns: 3, graph_height: 120, show_icons: true, refresh_interval: 3600,
  metrics: [
    { entity: "sensor.download", name: "Download", unit: "Mbps", decimals: 1, min: 10, max: 70, color: "#65b7e8" },
    { entity: "sensor.upload", name: "Upload", unit: "Mbps", decimals: 1, min: 5, max: 30, color: "#b09be9" },
    { entity: "sensor.ping", name: "Ping", icon: "mdi:timer-outline", unit: "ms", min: 2, max: 50, color: "#ff9f43" },
  ],
  ...overrides,
});

const history = (entityIds) => Object.fromEntries(entityIds.map((entityId, entityIndex) => [entityId, Array.from({ length: 12 }, (_, index) => ({ s: String(10 + entityIndex * 10 + index), lu: (Date.now() - (11 - index) * 300000) / 1000 }))]));

test("registers and renders multiple graphs, labels, values, units and icons", async () => {
  await import("../src/index.js");
  assert.equal(window.customCards.filter((card) => card.type === "multi-metric-graph-card").length, 1);
  const calls = [];
  const card = document.createElement("multi-metric-graph-card");
  card.setConfig(config());
  card.hass = { states, locale: { language: "en" }, connection: { connected: true }, callWS: async (message) => { calls.push(message); return history(message.entity_ids); } };
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].entity_ids, ["sensor.download", "sensor.upload", "sensor.ping"]);
  assert.equal(card.shadowRoot.querySelectorAll(".metric").length, 3);
  assert.equal(card.shadowRoot.querySelectorAll(".graph path").length, 6);
  assert.equal(card.shadowRoot.querySelectorAll("ha-icon").length, 3);
  assert.match(card.shadowRoot.textContent, /Download54\.3 Mbps/);
  assert.match(card.shadowRoot.textContent, /Ping7 ms/);
  assert.equal(card.shadowRoot.querySelector("ha-card").style.getPropertyValue("--columns"), "3");
  assert.equal(card.shadowRoot.querySelector("ha-card").style.getPropertyValue("--graph-height"), "120px");
  assert.equal(card.shadowRoot.querySelectorAll(".label").length, 3);
  assert.equal(card.shadowRoot.querySelectorAll(".balance").length, 3);
  assert.match(card.shadowRoot.querySelector("style").textContent, /grid-template-columns:minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  card.remove();
});

test("updates current values without refetching and supports per-metric icon visibility", async () => {
  let calls = 0;
  const card = document.createElement("multi-metric-graph-card");
  card.setConfig(config({ show_icons: false, metrics: [{ entity: "sensor.download", name: "Download", unit: "Mbps", show_icon: true, decimals: 1 }, { entity: "sensor.ping", name: "Ping", unit: "ms" }] }));
  card.hass = { states, locale: { language: "en" }, connection: { connected: true }, callWS: async ({ entity_ids }) => { calls++; return history(entity_ids); } };
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(card.shadowRoot.querySelectorAll("ha-icon").length, 1);
  card.hass = { ...card._hass, states: { ...states, "sensor.download": { ...states["sensor.download"], state: "60" } } };
  assert.match(card.shadowRoot.textContent, /Download60\.0 Mbps/);
  assert.equal(calls, 1);
  card.remove();
});

test("supports title, missing history, unavailable values and more-info keyboard interaction", async () => {
  const card = document.createElement("multi-metric-graph-card");
  card.setConfig(config({ title: "Internet", show_title: true }));
  card.hass = { states: { ...states, "sensor.download": { ...states["sensor.download"], state: "unavailable" } }, connection: { connected: true }, callWS: async () => ({}) };
  let selected;
  card.addEventListener("hass-more-info", (event) => { selected = event.detail.entityId; });
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(card.shadowRoot.querySelector(".title").textContent, "Internet");
  assert.match(card.shadowRoot.textContent, /unavailable/i);
  card.shadowRoot.querySelector(".metric").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(selected, "sensor.download");
  assert.match(card.shadowRoot.querySelector("style").textContent, /@container \(max-width:420px\)/);
  card.remove();
});

test("supports an explicit total card height", () => {
  const card = document.createElement("multi-metric-graph-card");
  card.setConfig(config({ card_height: 260 }));
  const root = card.shadowRoot.querySelector("ha-card");
  assert.equal(root.className, "fixed-height");
  assert.equal(root.style.getPropertyValue("--card-height"), "260px");
  assert.equal(card.getCardSize(), 6);
});

test("provides an editor and Sections sizing metadata", async () => {
  const editor = await customElements.get("multi-metric-graph-card").getConfigElement();
  editor.hass = { states };
  editor.setConfig(config());
  assert.equal(editor.shadowRoot.querySelectorAll("ha-entity-picker").length, 3);
  assert.ok(editor.shadowRoot.querySelector('[data-key="card_height"]'));
  const card = document.createElement("multi-metric-graph-card");
  card.setConfig(config());
  assert.ok(card.getCardSize() >= 3);
  assert.deepEqual(card.getGridOptions(), { columns: 12, rows: "auto", min_columns: 3, min_rows: 2 });
});
