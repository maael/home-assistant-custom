import {
  DOCKER_STATUS_DEFAULTS, METRICS, defaultActionEntity, dockerStatusPresentation,
  normalizeDockerStatusConfig, resolveColor,
} from "./docker-status-data.js";

const STYLE = `
  :host { display:inline-block; vertical-align:middle; }
  ha-badge {
    --ha-badge-size:36px;
    --badge-color:var(--docker-primary-color);
    outline:none;
  }
  ha-badge[type="button"] { cursor:pointer; }
  ha-badge:focus-visible { box-shadow:0 0 0 2px var(--primary-color); border-radius:18px; }
  .primary-icon { width:20px; height:20px; --mdc-icon-size:20px; color:var(--docker-primary-color); }
  .content { display:inline-flex; align-items:center; gap:6px; min-width:0; white-space:nowrap; font-size:12px; line-height:1; font-weight:500; font-variant-numeric:tabular-nums; }
  .metric { display:inline-flex; align-items:center; gap:3px; color:var(--metric-color); }
  .metric-icon { flex:0 0 auto; width:15px; height:15px; --mdc-icon-size:15px; }
  .count { min-width:0; }
  .separator { align-self:stretch; width:1px; min-height:16px; margin:0 1px; background:var(--divider-color, rgba(127,127,127,.28)); }
`;

const activationKey = (event) => event.key === "Enter" || event.key === " ";
const actionEnabled = (action) => action && action.action && action.action !== "none";

export class DockerStatusBadge extends HTMLElement {
  static getStubConfig(hass) {
    const numericSensors = Object.entries(hass?.states || {})
      .filter(([entityId, state]) => entityId.startsWith("sensor.") && Number.isFinite(Number(state?.state)))
      .map(([entityId]) => entityId);
    return { total_entity: numericSensors[0] || "sensor.example" };
  }

  static async getConfigElement() { return document.createElement("docker-status-badge-editor"); }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._holdTimer = null;
    this._tapTimer = null;
    this._lastTap = 0;
    this._held = false;
  }

  setConfig(config) {
    this._config = normalizeDockerStatusConfig(config);
    this._render();
  }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  disconnectedCallback() {
    clearTimeout(this._holdTimer);
    clearTimeout(this._tapTimer);
  }

  _render() {
    if (!this._config) return;
    const presentation = dockerStatusPresentation(this._config, this._hass?.states);
    const total = presentation.metrics.total;
    const secondary = [presentation.metrics.updates, presentation.metrics.errors, presentation.metrics.up_to_date].filter((metric) => metric.visible);
    const hasPrimary = Boolean((this._config.show_icon && this._config.icon) || total.visible);
    const hasSecondary = secondary.length > 0 || presentation.healthy;
    const label = this._accessibleLabel(presentation);

    const style = document.createElement("style");
    style.textContent = STYLE;
    const badge = document.createElement("ha-badge");
    const interactive = [this._config.tap_action, this._config.hold_action, this._config.double_tap_action].some(actionEnabled);
    if (interactive) {
      badge.setAttribute("type", "button");
      badge.tabIndex = 0;
    }
    badge.setAttribute("accessible-label", label);
    badge.setAttribute("aria-label", label);
    badge.title = label;
    const primaryColor = total.enabled && !total.available ? resolveColor(this._config.unavailable_color) : resolveColor(this._config.icon_color);
    badge.style.setProperty("--docker-primary-color", primaryColor);

    if (this._config.show_icon && this._config.icon) {
      const icon = document.createElement("ha-icon");
      icon.className = "primary-icon";
      icon.slot = "icon";
      icon.setAttribute("icon", String(this._config.icon));
      icon.setAttribute("aria-hidden", "true");
      badge.append(icon);
    }

    const content = document.createElement("span");
    content.className = "content";
    if (total.visible) content.append(this._metricNode(total, false));
    if (this._config.show_separator && hasPrimary && hasSecondary) {
      const separator = document.createElement("span");
      separator.className = "separator";
      separator.setAttribute("aria-hidden", "true");
      content.append(separator);
    }
    for (const metric of secondary) content.append(this._metricNode(metric, true));
    if (presentation.healthy) {
      const healthy = document.createElement("span");
      healthy.className = "metric healthy";
      healthy.style.setProperty("--metric-color", resolveColor(this._config.healthy_color));
      healthy.title = "Docker monitoring is healthy";
      const icon = document.createElement("ha-icon");
      icon.className = "metric-icon";
      icon.setAttribute("icon", String(this._config.healthy_icon));
      icon.setAttribute("aria-hidden", "true");
      healthy.append(icon);
      content.append(healthy);
    }
    if (content.childNodes.length) badge.append(content);
    else if (this._config.show_icon && this._config.icon) badge.setAttribute("icon-only", "");
    if (interactive) this._installInteractions(badge);
    this.shadowRoot.replaceChildren(style, badge);
  }

  _metricNode(metric, showIcon) {
    const node = document.createElement("span");
    node.className = `metric ${metric.key}`;
    node.style.setProperty("--metric-color", metric.color);
    node.title = metric.available ? `${metric.text} ${metric.label}` : `${metric.label} unavailable`;
    if (showIcon && this._config[metric.icon]) {
      const icon = document.createElement("ha-icon");
      icon.className = "metric-icon";
      icon.setAttribute("icon", String(this._config[metric.icon]));
      icon.setAttribute("aria-hidden", "true");
      node.append(icon);
    }
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = metric.text;
    node.append(count);
    return node;
  }

  _accessibleLabel(presentation) {
    const parts = [];
    for (const definition of METRICS) {
      const metric = presentation.metrics[definition.key];
      if (!metric.visible) continue;
      parts.push(metric.available ? `${metric.text} ${metric.label}` : `${metric.label} unavailable`);
    }
    if (presentation.healthy) parts.push("no updates or errors");
    return `Docker: ${parts.length ? parts.join(", ") : "status"}`;
  }

  _installInteractions(badge) {
    badge.addEventListener("pointerdown", () => {
      this._held = false;
      clearTimeout(this._holdTimer);
      if (actionEnabled(this._config.hold_action)) {
        this._holdTimer = setTimeout(() => {
          this._held = true;
          this._performAction(this._config.hold_action);
        }, 500);
      }
    });
    const cancelHold = () => clearTimeout(this._holdTimer);
    badge.addEventListener("pointerup", cancelHold);
    badge.addEventListener("pointercancel", cancelHold);
    badge.addEventListener("pointerleave", cancelHold);
    badge.addEventListener("click", () => {
      if (this._held) { this._held = false; return; }
      if (!actionEnabled(this._config.double_tap_action)) {
        this._performAction(this._config.tap_action);
        return;
      }
      const now = Date.now();
      if (now - this._lastTap < 300) {
        clearTimeout(this._tapTimer);
        this._lastTap = 0;
        this._performAction(this._config.double_tap_action);
        return;
      }
      this._lastTap = now;
      clearTimeout(this._tapTimer);
      this._tapTimer = setTimeout(() => {
        this._lastTap = 0;
        this._performAction(this._config.tap_action);
      }, 300);
    });
    badge.addEventListener("keydown", (event) => {
      if (activationKey(event)) {
        event.preventDefault();
        this._performAction(this._config.tap_action);
      }
    });
  }

  _performAction(action) {
    if (!actionEnabled(action)) return;
    const kind = action.action;
    if (kind === "more-info") {
      const entityId = action.entity || defaultActionEntity(this._config);
      if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
      return;
    }
    if (kind === "url") {
      const path = action.url_path || action.url;
      if (path) window.open(path, "_blank", "noopener");
      return;
    }
    if (kind === "navigate") {
      if (action.navigation_path) {
        window.history.pushState(null, "", action.navigation_path);
        window.dispatchEvent(new window.Event("location-changed"));
      }
      return;
    }
    if (kind === "perform-action" || kind === "call-service") {
      const serviceName = action.perform_action || action.service;
      const [domain, service] = String(serviceName || "").split(".", 2);
      if (domain && service && this._hass?.callService) this._hass.callService(domain, service, action.data || action.service_data || {}, action.target);
    }
  }
}

const EDITOR_STYLE = `
  :host { display:block; }
  .form { display:grid; gap:14px; padding:8px 0; }
  section, details { display:grid; gap:10px; padding:12px; border:1px solid var(--divider-color); border-radius:10px; }
  details > div { display:grid; gap:10px; padding-top:10px; }
  h3, summary { margin:0; color:var(--primary-text-color); font-size:14px; font-weight:600; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  label { display:grid; gap:5px; color:var(--primary-text-color); font-size:13px; }
  .check { display:flex; align-items:center; gap:8px; min-height:30px; }
  input, select { box-sizing:border-box; width:100%; min-height:40px; padding:8px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:6px; }
  ha-entity-picker, ha-icon-picker { display:block; }
  .action { display:grid; gap:8px; padding-top:6px; }
  .action + .action { border-top:1px solid var(--divider-color); padding-top:12px; }
  @media (max-width:500px) { .grid { grid-template-columns:1fr; } }
`;

export class DockerStatusBadgeEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this._render(); }
  setConfig(config) { this._config = structuredClone(config || {}); this._render(); }

  _emit(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config } }));
    this._render();
  }

  _render() {
    if (!this._config) return;
    const values = { ...DOCKER_STATUS_DEFAULTS, ...this._config };
    const style = document.createElement("style"); style.textContent = EDITOR_STYLE;
    const form = document.createElement("div"); form.className = "form";

    const entities = this._section("Entities");
    const entityGrid = document.createElement("div"); entityGrid.className = "grid";
    for (const [key, label] of [["total_entity", "Total containers"], ["updates_entity", "Updates available"], ["errors_entity", "Errors"], ["up_to_date_entity", "Up to date"]]) entityGrid.append(this._picker(key, label, values[key], "entity"));
    entities.append(entityGrid); form.append(entities);

    const appearance = this._section("Appearance");
    const iconGrid = document.createElement("div"); iconGrid.className = "grid";
    for (const [key, label] of [["icon", "Docker icon"], ["updates_icon", "Updates icon"], ["errors_icon", "Errors icon"], ["up_to_date_icon", "Up-to-date icon"]]) iconGrid.append(this._picker(key, label, values[key], "icon"));
    for (const [key, label] of [["icon_color", "Docker icon colour"], ["total_color", "Total colour"], ["updates_color", "Updates colour"], ["errors_color", "Errors colour"], ["up_to_date_color", "Up-to-date colour"], ["zero_color", "Zero colour"], ["unavailable_color", "Unavailable colour"]]) iconGrid.append(this._input(key, label, values[key]));
    appearance.append(iconGrid); form.append(appearance);

    const visibility = this._section("Visibility");
    const visibilityGrid = document.createElement("div"); visibilityGrid.className = "grid";
    for (const [key, label] of [["show_icon", "Show Docker icon"], ["show_total", "Show total"], ["show_updates", "Show updates"], ["show_errors", "Show errors"], ["show_up_to_date", "Show up-to-date"], ["show_separator", "Show separator"]]) visibilityGrid.append(this._checkbox(key, label, values[key]));
    visibility.append(visibilityGrid); form.append(visibility);

    const advanced = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = "Advanced status display";
    const advancedBody = document.createElement("div");
    const advancedGrid = document.createElement("div"); advancedGrid.className = "grid";
    for (const [key, label] of [["show_zero_updates", "Show zero updates"], ["show_zero_errors", "Show zero errors"], ["show_zero_up_to_date", "Show zero up-to-date"], ["show_healthy_indicator", "Show healthy indicator"]]) advancedGrid.append(this._checkbox(key, label, values[key]));
    advancedGrid.append(this._picker("healthy_icon", "Healthy icon", values.healthy_icon, "icon"), this._input("healthy_color", "Healthy colour", values.healthy_color));
    advancedBody.append(advancedGrid); advanced.append(summary, advancedBody); form.append(advanced);

    const actions = this._section("Actions");
    for (const [key, label] of [["tap_action", "Tap action"], ["hold_action", "Hold action"], ["double_tap_action", "Double-tap action"]]) actions.append(this._actionEditor(key, label, values[key]));
    form.append(actions);
    this.shadowRoot.replaceChildren(style, form);
  }

  _section(titleText) {
    const section = document.createElement("section");
    const title = document.createElement("h3"); title.textContent = titleText;
    section.append(title); return section;
  }

  _picker(key, labelText, value, type) {
    const label = document.createElement("label"); label.textContent = labelText;
    const picker = document.createElement(type === "entity" ? "ha-entity-picker" : "ha-icon-picker");
    picker.dataset.key = key; picker.hass = this._hass; picker.value = value || ""; picker.label = labelText;
    if (type === "entity") picker.allowCustomEntity = true;
    picker.addEventListener("value-changed", (event) => this._change(key, event.detail?.value || undefined));
    label.append(picker); return label;
  }

  _input(key, labelText, value) {
    const label = document.createElement("label"); label.textContent = labelText;
    const input = document.createElement("input"); input.dataset.key = key; input.value = value ?? "";
    input.addEventListener("change", () => this._change(key, input.value || undefined));
    label.append(input); return label;
  }

  _checkbox(key, labelText, checked) {
    const label = document.createElement("label"); label.className = "check";
    const input = document.createElement("input"); input.type = "checkbox"; input.dataset.key = key; input.checked = Boolean(checked);
    input.addEventListener("change", () => this._change(key, input.checked));
    label.append(input, document.createTextNode(labelText)); return label;
  }

  _actionEditor(key, labelText, value = {}) {
    const action = value || { action: "none" };
    const wrap = document.createElement("div"); wrap.className = "action";
    const label = document.createElement("label"); label.textContent = labelText;
    const select = document.createElement("select"); select.dataset.key = `${key}.action`;
    for (const [optionValue, text] of [["more-info", "More info"], ["url", "URL"], ["navigate", "Navigate"], ["perform-action", "Perform action"], ["none", "None"]]) {
      const option = document.createElement("option"); option.value = optionValue; option.textContent = text; select.append(option);
    }
    select.value = action.action || "none";
    select.addEventListener("change", () => this._changeAction(key, "action", select.value));
    label.append(select); wrap.append(label);
    wrap.append(
      this._actionEntityPicker(key, action.entity),
      this._actionInput(key, "url_path", "URL path", action.url_path),
      this._actionInput(key, "navigation_path", "Navigation path", action.navigation_path),
      this._actionInput(key, "perform_action", "Action (domain.service)", action.perform_action || action.service),
    );
    return wrap;
  }

  _actionEntityPicker(actionKey, value) {
    const label = document.createElement("label"); label.textContent = "More-info entity (optional)";
    const picker = document.createElement("ha-entity-picker"); picker.hass = this._hass; picker.value = value || ""; picker.allowCustomEntity = true;
    picker.dataset.key = `${actionKey}.entity`;
    picker.addEventListener("value-changed", (event) => this._changeAction(actionKey, "entity", event.detail?.value || undefined));
    label.append(picker); return label;
  }

  _actionInput(actionKey, property, labelText, value) {
    const label = document.createElement("label"); label.textContent = labelText;
    const input = document.createElement("input"); input.dataset.key = `${actionKey}.${property}`; input.value = value || "";
    input.addEventListener("change", () => this._changeAction(actionKey, property, input.value || undefined));
    label.append(input); return label;
  }

  _change(key, value) {
    const config = structuredClone(this._config);
    if (value === undefined) delete config[key]; else config[key] = value;
    this._emit(config);
  }

  _changeAction(actionKey, property, value) {
    const config = structuredClone(this._config);
    const action = { ...(config[actionKey] || DOCKER_STATUS_DEFAULTS[actionKey]) };
    if (value === undefined) delete action[property]; else action[property] = value;
    config[actionKey] = action;
    this._emit(config);
  }
}

if (!customElements.get("docker-status-badge")) customElements.define("docker-status-badge", DockerStatusBadge);
if (!customElements.get("docker-status-badge-editor")) customElements.define("docker-status-badge-editor", DockerStatusBadgeEditor);
