const DEFAULTS = {
  enter_text: "Go fullscreen",
  exit_text: "Exit fullscreen",
  enter_icon: "mdi:fullscreen",
  exit_icon: "mdi:fullscreen-exit",
  enter_icon_color: "var(--primary-color)",
  exit_icon_color: "var(--primary-color)",
  background_color: null,
  text_color: null,
  badge_size: "36px",
  enable_f11: false,
};

const STYLE = `
  :host { display:inline-block; }
  ha-badge {
    --badge-color:var(--fullscreen-icon-color);
    --ha-badge-size:var(--fullscreen-badge-size);
  }
`;

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Fullscreen Toggle Badge requires a configuration object.");
  const normalized = { ...DEFAULTS, ...config };
  // Keep the text keys used by KTibow/fullscreen-card as migration aliases.
  if (config.enter_text === undefined && config.go_fullscreen !== undefined) normalized.enter_text = config.go_fullscreen;
  if (config.exit_text === undefined && config.exit_fullscreen !== undefined) normalized.exit_text = config.exit_fullscreen;
  normalized.badge_size = String(normalized.badge_size || DEFAULTS.badge_size);
  return normalized;
}

export class FullscreenToggleBadge extends HTMLElement {
  static getStubConfig() { return {}; }
  static async getConfigElement() { return document.createElement("fullscreen-toggle-badge-editor"); }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sync = () => this._render();
    this._onKeydown = (event) => {
      if (this._config?.enable_f11 && event.key === "F11" && !event.defaultPrevented) {
        event.preventDefault();
        this._toggleFullscreen();
      }
    };
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(value) { this._hass = value; }
  set preview(value) { this._preview = value; }

  connectedCallback() {
    document.addEventListener("fullscreenchange", this._sync);
    document.addEventListener("webkitfullscreenchange", this._sync);
    window.addEventListener("resize", this._sync);
    document.addEventListener("keydown", this._onKeydown);
    this._render();
  }

  disconnectedCallback() {
    document.removeEventListener("fullscreenchange", this._sync);
    document.removeEventListener("webkitfullscreenchange", this._sync);
    window.removeEventListener("resize", this._sync);
    document.removeEventListener("keydown", this._onKeydown);
  }

  _isFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement || window.fullScreen);
  }

  async _toggleFullscreen() {
    try {
      if (this._isFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exit) throw new Error("This browser does not support exiting fullscreen.");
        await exit.call(document);
      } else {
        const target = document.documentElement;
        const request = target.requestFullscreen || target.webkitRequestFullscreen;
        if (!request) throw new Error("This browser does not support the Fullscreen API.");
        await request.call(target);
      }
    } catch (error) {
      console.error("Fullscreen Toggle Badge:", error);
      this.dispatchEvent(new CustomEvent("fullscreen-error", { bubbles: true, composed: true, detail: { error } }));
    }
    this._render();
  }

  _render() {
    if (!this._config) return;
    const fullscreen = this._isFullscreen();
    const text = fullscreen ? this._config.exit_text : this._config.enter_text;
    const iconName = fullscreen ? this._config.exit_icon : this._config.enter_icon;
    const iconColor = fullscreen ? this._config.exit_icon_color : this._config.enter_icon_color;
    const accessibleLabel = String(text || (fullscreen ? "Exit fullscreen" : "Go fullscreen"));

    const style = document.createElement("style");
    style.textContent = STYLE;
    const badge = document.createElement("ha-badge");
    badge.setAttribute("type", "button");
    badge.setAttribute("accessible-label", accessibleLabel);
    badge.setAttribute("aria-pressed", String(fullscreen));
    badge.title = accessibleLabel;
    if (!text) badge.setAttribute("icon-only", "");
    badge.style.setProperty("--fullscreen-icon-color", String(iconColor));
    badge.style.setProperty("--fullscreen-badge-size", this._config.badge_size);
    if (this._config.background_color) badge.style.setProperty("--ha-card-background", String(this._config.background_color));
    if (this._config.text_color) badge.style.setProperty("--primary-text-color", String(this._config.text_color));
    badge.addEventListener("click", () => this._toggleFullscreen());
    badge.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this._toggleFullscreen();
      }
    });

    if (iconName) {
      const icon = document.createElement("ha-icon");
      icon.slot = "icon";
      icon.setAttribute("icon", String(iconName));
      icon.setAttribute("aria-hidden", "true");
      badge.append(icon);
    }
    if (text) badge.append(document.createTextNode(String(text)));
    this.shadowRoot.replaceChildren(style, badge);
  }
}

const EDITOR_STYLE = `
  :host { display:block; }
  .form { display:grid; gap:12px; padding:8px 0; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  label { display:grid; gap:5px; color:var(--primary-text-color); font-size:13px; }
  input { box-sizing:border-box; min-height:40px; padding:8px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:6px; }
  .check { display:flex; align-items:center; gap:8px; }
  @media (max-width:500px) { .row { grid-template-columns:1fr; } }
`;

export class FullscreenToggleBadgeEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; }
  setConfig(config) { this._config = structuredClone(config || {}); this._render(); }

  _render() {
    if (!this._config) return;
    const values = normalizeConfig(this._config);
    const style = document.createElement("style"); style.textContent = EDITOR_STYLE;
    const form = document.createElement("div"); form.className = "form";
    const fields = [
      ["enter_text", "Text when not fullscreen"], ["exit_text", "Text when fullscreen"],
      ["enter_icon", "Icon when not fullscreen"], ["exit_icon", "Icon when fullscreen"],
      ["enter_icon_color", "Icon colour when not fullscreen"], ["exit_icon_color", "Icon colour when fullscreen"],
      ["background_color", "Badge background (optional)"], ["text_color", "Text colour (optional)"],
      ["badge_size", "Badge height (CSS length)"],
    ];
    for (let index = 0; index < fields.length; index += 2) {
      const row = document.createElement("div"); row.className = "row";
      for (const [key, labelText] of fields.slice(index, index + 2)) row.append(this._textField(key, labelText, values[key]));
      form.append(row);
    }
    const f11Label = document.createElement("label"); f11Label.className = "check";
    const f11 = document.createElement("input"); f11.type = "checkbox"; f11.dataset.key = "enable_f11"; f11.checked = values.enable_f11;
    f11Label.append(f11, document.createTextNode("Use F11 as a fullscreen toggle while this badge is displayed")); form.append(f11Label);
    form.querySelectorAll("[data-key]").forEach((input) => input.addEventListener("change", () => this._change(input)));
    this.shadowRoot.replaceChildren(style, form);
  }

  _textField(key, labelText, value) {
    const label = document.createElement("label"); label.textContent = labelText;
    const input = document.createElement("input"); input.dataset.key = key; input.value = value ?? "";
    label.append(input); return label;
  }

  _change(input) {
    const config = structuredClone(this._config);
    const key = input.dataset.key;
    config[key] = input.type === "checkbox" ? input.checked : input.value;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config } }));
  }
}

if (!customElements.get("fullscreen-toggle-badge")) customElements.define("fullscreen-toggle-badge", FullscreenToggleBadge);
if (!customElements.get("fullscreen-toggle-badge-editor")) customElements.define("fullscreen-toggle-badge-editor", FullscreenToggleBadgeEditor);
