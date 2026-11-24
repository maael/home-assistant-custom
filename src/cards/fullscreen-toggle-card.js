const DEFAULTS = {
  enter_text: "Go fullscreen",
  exit_text: "Exit fullscreen",
  enter_icon: "mdi:fullscreen",
  exit_icon: "mdi:fullscreen-exit",
  enter_icon_color: "currentColor",
  exit_icon_color: "currentColor",
  background_color: "var(--primary-color)",
  text_color: "var(--text-primary-color, white)",
  icon_position: "left",
  card_padding: "16px",
  button_height: 48,
  enable_f11: false,
};

const STYLE = `
  :host { display:block; }
  ha-card { box-sizing:border-box; padding:var(--fullscreen-card-padding); }
  button { width:100%; min-height:var(--fullscreen-button-height); box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:10px; padding:8px 14px; border:0; border-radius:var(--ha-card-border-radius, 12px); background:var(--fullscreen-button-background); color:var(--fullscreen-button-color); font:inherit; font-size:var(--ha-font-size-l, 16px); font-weight:500; cursor:pointer; }
  button:hover { filter:brightness(1.06); }
  button:active { filter:brightness(.94); }
  button:focus-visible { outline:2px solid var(--primary-text-color); outline-offset:2px; }
  button.icon-right { flex-direction:row-reverse; }
  ha-icon { flex:0 0 auto; color:var(--fullscreen-icon-color); }
`;

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Fullscreen Toggle Card requires a configuration object.");
  const normalized = { ...DEFAULTS, ...config };
  // Keep the text keys used by KTibow/fullscreen-card as migration aliases.
  if (config.enter_text === undefined && config.go_fullscreen !== undefined) normalized.enter_text = config.go_fullscreen;
  if (config.exit_text === undefined && config.exit_fullscreen !== undefined) normalized.exit_text = config.exit_fullscreen;
  normalized.icon_position = normalized.icon_position === "right" ? "right" : "left";
  normalized.button_height = Math.max(32, Number(normalized.button_height) || DEFAULTS.button_height);
  return normalized;
}

export class FullscreenToggleCard extends HTMLElement {
  static getStubConfig() { return {}; }
  static async getConfigElement() { return document.createElement("fullscreen-toggle-card-editor"); }

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
    this._rawConfig = structuredClone(config);
    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(value) { this._hass = value; }

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

  getCardSize() { return 1; }
  getGridOptions() { return { columns: 12, rows: 1, min_columns: 2, min_rows: 1 }; }

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
      console.error("Fullscreen Toggle Card:", error);
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

    const style = document.createElement("style");
    style.textContent = STYLE;
    const card = document.createElement("ha-card");
    card.style.setProperty("--fullscreen-card-padding", String(this._config.card_padding));
    card.style.setProperty("--fullscreen-button-height", `${this._config.button_height}px`);
    card.style.setProperty("--fullscreen-button-background", String(this._config.background_color));
    card.style.setProperty("--fullscreen-button-color", String(this._config.text_color));
    card.style.setProperty("--fullscreen-icon-color", String(iconColor));

    const button = document.createElement("button");
    button.type = "button";
    button.className = this._config.icon_position === "right" ? "icon-right" : "";
    button.setAttribute("aria-label", String(text || (fullscreen ? "Exit fullscreen" : "Go fullscreen")));
    button.setAttribute("aria-pressed", String(fullscreen));
    button.title = String(text || (fullscreen ? "Exit fullscreen" : "Go fullscreen"));
    button.addEventListener("click", () => this._toggleFullscreen());
    if (iconName) {
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", String(iconName));
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
    }
    if (text) {
      const label = document.createElement("span");
      label.textContent = String(text);
      button.append(label);
    }
    card.append(button);
    this.shadowRoot.replaceChildren(style, card);
  }
}

const EDITOR_STYLE = `
  :host { display:block; }
  .form { display:grid; gap:12px; padding:8px 0; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  label { display:grid; gap:5px; color:var(--primary-text-color); font-size:13px; }
  input, select { box-sizing:border-box; min-height:40px; padding:8px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:6px; }
  .check { display:flex; align-items:center; gap:8px; }
  @media (max-width:500px) { .row { grid-template-columns:1fr; } }
`;

export class FullscreenToggleCardEditor extends HTMLElement {
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
      ["background_color", "Button background"], ["text_color", "Text colour"],
    ];
    for (let index = 0; index < fields.length; index += 2) {
      const row = document.createElement("div"); row.className = "row";
      for (const [key, labelText] of fields.slice(index, index + 2)) row.append(this._textField(key, labelText, values[key]));
      form.append(row);
    }
    const options = document.createElement("div"); options.className = "row";
    const positionLabel = document.createElement("label"); positionLabel.textContent = "Icon position";
    const position = document.createElement("select"); position.dataset.key = "icon_position";
    for (const value of ["left", "right"]) { const option = document.createElement("option"); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); position.append(option); }
    position.value = values.icon_position; positionLabel.append(position);
    const height = this._textField("button_height", "Minimum button height (px)", values.button_height, "number");
    options.append(positionLabel, height); form.append(options);
    const f11Label = document.createElement("label"); f11Label.className = "check";
    const f11 = document.createElement("input"); f11.type = "checkbox"; f11.dataset.key = "enable_f11"; f11.checked = values.enable_f11;
    f11Label.append(f11, document.createTextNode("Use F11 as a fullscreen toggle while this card is displayed")); form.append(f11Label);
    form.querySelectorAll("[data-key]").forEach((input) => input.addEventListener("change", () => this._change(input)));
    this.shadowRoot.replaceChildren(style, form);
  }

  _textField(key, labelText, value, type = "text") {
    const label = document.createElement("label"); label.textContent = labelText;
    const input = document.createElement("input"); input.type = type; input.dataset.key = key; input.value = value ?? "";
    if (type === "number") input.min = "32";
    label.append(input); return label;
  }

  _change(input) {
    const config = structuredClone(this._config);
    const key = input.dataset.key;
    const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    config[key] = value;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config } }));
  }
}

if (!customElements.get("fullscreen-toggle-card")) customElements.define("fullscreen-toggle-card", FullscreenToggleCard);
if (!customElements.get("fullscreen-toggle-card-editor")) customElements.define("fullscreen-toggle-card-editor", FullscreenToggleCardEditor);
