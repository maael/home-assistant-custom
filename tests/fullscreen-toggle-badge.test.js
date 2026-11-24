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

test("registers as a Home Assistant badge and renders configurable normal-state content", () => {
  installFullscreenMock();
  assert.equal(window.customBadges.filter((badge) => badge.type === "fullscreen-toggle-badge").length, 1);
  assert.equal(window.customCards.filter((card) => card.type.includes("fullscreen-toggle")).length, 0);
  const badge = document.createElement("fullscreen-toggle-badge");
  badge.setConfig({
    enter_text: "Cinema mode", enter_icon: "mdi:movie-open", enter_icon_color: "deepskyblue",
    background_color: "#111", text_color: "#eee", badge_size: "42px",
  });
  document.body.append(badge);
  const root = badge.shadowRoot.querySelector("ha-badge");
  assert.equal(root.textContent, "Cinema mode");
  assert.equal(root.getAttribute("type"), "button");
  assert.equal(root.getAttribute("aria-pressed"), "false");
  assert.equal(badge.shadowRoot.querySelector("ha-icon").getAttribute("icon"), "mdi:movie-open");
  assert.equal(badge.shadowRoot.querySelector("ha-icon").slot, "icon");
  assert.equal(root.style.getPropertyValue("--fullscreen-icon-color"), "deepskyblue");
  assert.equal(root.style.getPropertyValue("--fullscreen-badge-size"), "42px");
  assert.equal(root.style.getPropertyValue("--ha-card-background"), "#111");
  assert.equal(root.style.getPropertyValue("--primary-text-color"), "#eee");
  assert.equal(badge.shadowRoot.querySelector("ha-card"), null);
  badge.remove();
});

test("toggles fullscreen and switches badge text, icon, and icon colour", async () => {
  const fullscreen = installFullscreenMock();
  const badge = document.createElement("fullscreen-toggle-badge");
  badge.setConfig({
    enter_text: "Enter", exit_text: "Leave", enter_icon: "mdi:arrow-expand", exit_icon: "mdi:arrow-collapse",
    enter_icon_color: "blue", exit_icon_color: "orange",
  });
  document.body.append(badge);
  badge.shadowRoot.querySelector("ha-badge").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fullscreen.value, document.documentElement);
  assert.equal(badge.shadowRoot.querySelector("ha-badge").textContent, "Leave");
  assert.equal(badge.shadowRoot.querySelector("ha-badge").getAttribute("aria-pressed"), "true");
  assert.equal(badge.shadowRoot.querySelector("ha-icon").getAttribute("icon"), "mdi:arrow-collapse");
  assert.equal(badge.shadowRoot.querySelector("ha-badge").style.getPropertyValue("--fullscreen-icon-color"), "orange");
  badge.shadowRoot.querySelector("ha-badge").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fullscreen.value, null);
  assert.equal(badge.shadowRoot.querySelector("ha-badge").textContent, "Enter");
  badge.remove();
});

test("supports icon-only badges and original card text aliases", () => {
  installFullscreenMock();
  const badge = document.createElement("fullscreen-toggle-badge");
  badge.setConfig({ go_fullscreen: "Theatre", exit_fullscreen: "Stop", enter_icon: "" });
  assert.equal(badge.shadowRoot.querySelector("ha-badge").textContent, "Theatre");
  assert.equal(badge.shadowRoot.querySelector("ha-icon"), null);
  badge.setConfig({ enter_text: "", enter_icon: "mdi:fullscreen" });
  const root = badge.shadowRoot.querySelector("ha-badge");
  assert.equal(root.textContent, "");
  assert.equal(root.hasAttribute("icon-only"), true);
  assert.equal(root.getAttribute("accessible-label"), "Go fullscreen");
});

test("provides a badge editor", async () => {
  const editor = await customElements.get("fullscreen-toggle-badge").getConfigElement();
  editor.setConfig({ enter_text: "Open", exit_icon_color: "red", badge_size: "40px" });
  assert.equal(editor.shadowRoot.querySelector('[data-key="enter_text"]').value, "Open");
  assert.equal(editor.shadowRoot.querySelector('[data-key="exit_icon_color"]').value, "red");
  assert.equal(editor.shadowRoot.querySelector('[data-key="badge_size"]').value, "40px");
  assert.ok(editor.shadowRoot.querySelector('[data-key="enable_f11"]'));
});
