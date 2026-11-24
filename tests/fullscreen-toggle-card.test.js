import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const window = new Window({ url: "http://homeassistant.local/" });
Object.assign(globalThis, {
  window, document: window.document, HTMLElement: window.HTMLElement, customElements: window.customElements,
  CustomEvent: window.CustomEvent, location: window.location,
});
await import("../src/index.js");
after(async () => window.happyDOM.abort());

function installFullscreenMock() {
  let fullscreenElement = null;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  document.documentElement.requestFullscreen = async () => {
    fullscreenElement = document.documentElement;
    document.dispatchEvent(new window.Event("fullscreenchange"));
  };
  document.exitFullscreen = async () => {
    fullscreenElement = null;
    document.dispatchEvent(new window.Event("fullscreenchange"));
  };
  return { get value() { return fullscreenElement; } };
}

test("registers with Home Assistant and renders configurable normal-state content", () => {
  installFullscreenMock();
  assert.equal(window.customCards.filter((card) => card.type === "fullscreen-toggle-card").length, 1);
  const card = document.createElement("fullscreen-toggle-card");
  card.setConfig({
    enter_text: "Cinema mode", enter_icon: "mdi:movie-open", enter_icon_color: "deepskyblue",
    background_color: "#111", text_color: "#eee", icon_position: "right", button_height: 56,
  });
  document.body.append(card);
  const button = card.shadowRoot.querySelector("button");
  assert.equal(button.textContent, "Cinema mode");
  assert.equal(button.className, "icon-right");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(card.shadowRoot.querySelector("ha-icon").getAttribute("icon"), "mdi:movie-open");
  const root = card.shadowRoot.querySelector("ha-card");
  assert.equal(root.style.getPropertyValue("--fullscreen-icon-color"), "deepskyblue");
  assert.equal(root.style.getPropertyValue("--fullscreen-button-height"), "56px");
  assert.equal(root.style.getPropertyValue("--fullscreen-button-background"), "#111");
  card.remove();
});

test("toggles fullscreen and switches text, icon, and icon colour", async () => {
  const fullscreen = installFullscreenMock();
  const card = document.createElement("fullscreen-toggle-card");
  card.setConfig({
    enter_text: "Enter", exit_text: "Leave", enter_icon: "mdi:arrow-expand", exit_icon: "mdi:arrow-collapse",
    enter_icon_color: "blue", exit_icon_color: "orange",
  });
  document.body.append(card);
  card.shadowRoot.querySelector("button").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fullscreen.value, document.documentElement);
  assert.equal(card.shadowRoot.querySelector("button").textContent, "Leave");
  assert.equal(card.shadowRoot.querySelector("button").getAttribute("aria-pressed"), "true");
  assert.equal(card.shadowRoot.querySelector("ha-icon").getAttribute("icon"), "mdi:arrow-collapse");
  assert.equal(card.shadowRoot.querySelector("ha-card").style.getPropertyValue("--fullscreen-icon-color"), "orange");
  card.shadowRoot.querySelector("button").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fullscreen.value, null);
  assert.equal(card.shadowRoot.querySelector("button").textContent, "Enter");
  card.remove();
});

test("supports icon-only buttons and original card text aliases", () => {
  installFullscreenMock();
  const card = document.createElement("fullscreen-toggle-card");
  card.setConfig({ go_fullscreen: "Theatre", exit_fullscreen: "Stop", enter_icon: "" });
  assert.equal(card.shadowRoot.querySelector("button").textContent, "Theatre");
  assert.equal(card.shadowRoot.querySelector("ha-icon"), null);
  card.setConfig({ enter_text: "", enter_icon: "mdi:fullscreen" });
  assert.equal(card.shadowRoot.querySelector("button").textContent, "");
  assert.equal(card.shadowRoot.querySelector("button").getAttribute("aria-label"), "Go fullscreen");
});

test("provides an editor and dashboard sizing metadata", async () => {
  const editor = await customElements.get("fullscreen-toggle-card").getConfigElement();
  editor.setConfig({ enter_text: "Open", exit_icon_color: "red" });
  assert.equal(editor.shadowRoot.querySelector('[data-key="enter_text"]').value, "Open");
  assert.equal(editor.shadowRoot.querySelector('[data-key="exit_icon_color"]').value, "red");
  assert.ok(editor.shadowRoot.querySelector('[data-key="enable_f11"]'));
  const card = document.createElement("fullscreen-toggle-card");
  card.setConfig({});
  assert.equal(card.getCardSize(), 1);
  assert.deepEqual(card.getGridOptions(), { columns: 12, rows: 1, min_columns: 2, min_rows: 1 });
});
