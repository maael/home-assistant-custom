import {
  appendCurrentPoint, colorForValue, detailPresentation, downsamplePoints, formatMetricValue,
  graphBounds, historyRequest, mergeSystemStatusConfig, parseHistoryStates, sparklineGeometry,
} from "./compact-system-status-data.js";

const STYLE = `
  :host { display:block; width:100%; height:auto; container-type:inline-size; }
  ha-card { display:block; width:100%; box-sizing:border-box; overflow:hidden; color:var(--primary-text-color); background:var(--ha-card-background, var(--card-background-color)); }
  .title { padding:12px 14px 4px; font-size:15px; line-height:20px; font-weight:600; }
  .content { min-width:0; }
  .metrics { display:grid; grid-template-columns:repeat(var(--metric-count), minmax(0, 1fr)); min-width:0; }
  .metric { position:relative; isolation:isolate; min-width:0; height:53px; box-sizing:border-box; display:flex; align-items:center; padding:8px 13px; overflow:hidden; cursor:pointer; outline:none; }
  .metric + .metric { border-left:1px solid var(--divider-color, rgba(127,127,127,.18)); }
  .metric:focus-visible, .detail:focus-visible { box-shadow:inset 0 0 0 2px var(--primary-color); border-radius:8px; }
  .graph { position:absolute; z-index:-1; inset:2px 4px 0; width:calc(100% - 8px); height:calc(100% - 2px); pointer-events:none; }
  .metric-text { display:flex; align-items:center; gap:6px; min-width:0; width:100%; padding:2px 3px; border-radius:5px; text-shadow:0 1px 2px var(--card-background-color), 0 0 5px var(--card-background-color); }
  .metric-icon { flex:0 0 auto; --mdc-icon-size:16px; width:16px; height:16px; }
  .metric-copy { min-width:0; display:flex; align-items:baseline; justify-content:space-between; gap:7px; width:100%; }
  .metric-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--secondary-text-color); font-size:11px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; }
  .metric-value { flex:0 0 auto; white-space:nowrap; font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; }
  .details { min-width:0; display:flex; align-items:center; border-top:1px solid var(--divider-color, rgba(127,127,127,.18)); min-height:32px; padding:0 6px; }
  .detail { min-width:0; flex:1 1 0; display:flex; align-items:center; justify-content:center; gap:6px; height:32px; padding:0 7px; box-sizing:border-box; cursor:pointer; outline:none; font-size:12px; color:var(--secondary-text-color); }
  .detail:first-child { justify-content:flex-start; }
  .detail:last-child { justify-content:flex-end; }
  .detail-icon { flex:0 0 auto; --mdc-icon-size:16px; width:16px; height:16px; color:var(--detail-color); }
  .dot { flex:0 0 auto; width:8px; height:8px; border-radius:50%; background:var(--detail-color); box-shadow:0 0 0 2px color-mix(in srgb, var(--detail-color) 18%, transparent); }
  .detail-text { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .detail:first-child .detail-text { text-overflow:clip; }
  .detail-name { color:var(--primary-text-color); font-weight:500; margin-right:4px; }
  .single-row .content { display:flex; align-items:stretch; min-height:52px; }
  .single-row .metrics { flex:1 1 auto; }
  .single-row .metric { height:52px; }
  .single-row .details { flex:0 1 auto; border-top:0; border-left:1px solid var(--divider-color, rgba(127,127,127,.18)); padding:0 5px; }
  .single-row .detail { height:52px; min-width:84px; }
  @container (max-width:600px) {
    .single-row .content { display:block; }
    .single-row .details { border-left:0; border-top:1px solid var(--divider-color, rgba(127,127,127,.18)); }
    .single-row .detail { height:32px; min-width:0; }
  }
  @container (max-width:360px) {
    .metric { padding-left:8px; padding-right:8px; }
    .metric-copy { display:block; }
    .metric-value { display:block; margin-top:1px; font-size:14px; }
    .details { padding-left:3px; padding-right:3px; }
    .detail { padding-left:5px; padding-right:5px; gap:4px; }
  }
`;

const isActivationKey = (event) => event.key === "Enter" || event.key === " ";

export class CompactSystemStatusCard extends HTMLElement {
  static getStubConfig() {
    return {
      metrics: [
        { entity: "sensor.system_monitor_processor_use", name: "CPU", min: 0, max: 100 },
        { entity: "sensor.system_monitor_memory_usage", name: "RAM", min: 0, max: 100 },
      ],
      details: [],
    };
  }

  static async getConfigElement() { return document.createElement("compact-system-status-card-editor"); }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._history = new Map();
    this._historyErrors = new Map();
    this._generation = 0;
  }

  setConfig(config) {
    this._config = mergeSystemStatusConfig(config);
    this._render();
    if (this.isConnected && this._hass) this._restartHistory(true);
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (this._editor) this._editor.hass = value;
    this._render();
    if (first && this.isConnected && this._config) this._restartHistory(true);
  }

  connectedCallback() {
    if (this._config && this._hass) this._restartHistory(true);
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
    this._generation++;
  }

  getCardSize() {
    const contentRows = this._config?.layout === "single-row" ? 1 : 2;
    return contentRows + (this._config?.show_title && this._config?.title ? 1 : 0);
  }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 3, min_rows: 1 }; }

  _restartHistory(immediate) {
    clearTimeout(this._timer);
    const generation = ++this._generation;
    if (immediate) this._fetchHistory(generation);
    else this._scheduleHistory(generation);
  }

  _scheduleHistory(generation) {
    if (!this.isConnected || generation !== this._generation) return;
    this._timer = setTimeout(() => this._fetchHistory(generation), this._config.refresh_interval * 1000);
  }

  async _fetchHistory(generation) {
    if (!this.isConnected || generation !== this._generation) return;
    if (this._historyInFlight) { this._scheduleHistory(generation); return; }
    clearTimeout(this._timer);
    const graphMetrics = this._config.metrics.filter((metric) => (metric.show_graph ?? this._config.show_graphs));
    if (!graphMetrics.length || !this._hass?.callWS || this._hass?.connection?.connected === false) {
      this._scheduleHistory(generation); return;
    }
    this._historyInFlight = true;
    const end = new Date();
    const groups = new Map();
    for (const metric of graphMetrics) {
      const hours = metric.hours_to_show ?? this._config.hours_to_show;
      if (!groups.has(hours)) groups.set(hours, []);
      if (!groups.get(hours).includes(metric.entity)) groups.get(hours).push(metric.entity);
    }
    const results = await Promise.allSettled([...groups].map(async ([hours, entityIds]) => {
      const start = new Date(end.getTime() - hours * 3600000);
      const response = await this._hass.callWS(historyRequest(start, end, entityIds));
      return { hours, entityIds, startMs: start.getTime(), endMs: end.getTime(), response };
    }));
    if (!this.isConnected || generation !== this._generation) {
      this._historyInFlight = false;
      if (this.isConnected) this._fetchHistory(this._generation);
      return;
    }
    for (const result of results) {
      if (result.status === "rejected") continue;
      const { entityIds, startMs, endMs, response } = result.value;
      for (const entityId of entityIds) {
        try {
          const points = parseHistoryStates(response?.[entityId], startMs, endMs);
          this._history.set(entityId, { points, startMs, endMs, fetchedAt: Date.now() });
          this._historyErrors.delete(entityId);
        } catch (error) { this._historyErrors.set(entityId, error.message); }
      }
    }
    this._historyInFlight = false;
    this._render();
    this._scheduleHistory(generation);
  }

  _render() {
    if (!this._config) return;
    const card = document.createElement("ha-card");
    card.className = this._config.layout === "single-row" ? "single-row" : "two-row";
    const style = document.createElement("style");
    style.textContent = STYLE;
    if (this._config.show_title && this._config.title) {
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = this._config.title;
      card.append(title);
    }
    const content = document.createElement("div");
    content.className = "content";
    const metrics = document.createElement("div");
    metrics.className = "metrics";
    metrics.style.setProperty("--metric-count", this._config.metrics.length);
    this._config.metrics.forEach((metric) => metrics.append(this._renderMetric(metric)));
    content.append(metrics);
    if (this._config.details.length) {
      const details = document.createElement("div");
      details.className = "details";
      this._config.details.forEach((detail) => details.append(this._renderDetail(detail)));
      content.append(details);
    }
    card.append(content);
    this.shadowRoot.replaceChildren(style, card);
  }

  _renderMetric(metric) {
    const state = this._hass?.states?.[metric.entity];
    const formatted = formatMetricValue(this._hass, state, metric);
    const name = metric.name ?? state?.attributes?.friendly_name ?? metric.entity;
    const iconName = metric.icon ?? state?.attributes?.icon;
    const showIcon = metric.show_icon ?? this._config.show_icons;
    const color = colorForValue(formatted.value, metric.color, metric.color_thresholds);
    const hours = metric.hours_to_show ?? this._config.hours_to_show;
    const node = this._interactive("div", metric.entity, `${name}: ${formatted.full}`);
    node.className = "metric";
    node.title = `${name}: ${formatted.full} · ${hours} hour history`;
    if ((metric.show_graph ?? this._config.show_graphs)) node.append(this._renderGraph(metric, state, color));
    const text = document.createElement("div"); text.className = "metric-text";
    if (showIcon && iconName) {
      const icon = document.createElement("ha-icon"); icon.className = "metric-icon"; icon.setAttribute("icon", iconName); icon.style.color = color; icon.setAttribute("aria-hidden", "true"); text.append(icon);
    }
    const copy = document.createElement("div"); copy.className = "metric-copy";
    const label = document.createElement("span"); label.className = "metric-name"; label.textContent = name;
    const value = document.createElement("span"); value.className = "metric-value"; value.textContent = formatted.text; value.style.color = color;
    copy.append(label, value); text.append(copy); node.append(text);
    return node;
  }

  _renderGraph(metric, state, color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "graph"); svg.setAttribute("viewBox", "0 0 100 46"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
    const history = this._history.get(metric.entity);
    if (!history) return svg;
    const endMs = Date.now();
    const startMs = endMs - (metric.hours_to_show ?? this._config.hours_to_show) * 3600000;
    const points = downsamplePoints(appendCurrentPoint(history.points.filter((point) => point.time >= startMs), state, endMs), 80);
    const bounds = graphBounds(points, metric.min, metric.max);
    const geometry = sparklineGeometry(points, { startMs, endMs, ...bounds });
    const lineOpacity = metric.graph_opacity ?? this._config.graph_opacity;
    const fillOpacity = metric.graph_fill_opacity ?? this._config.graph_fill_opacity;
    geometry.fills.forEach((pathData) => {
      const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", pathData); path.setAttribute("fill", color); path.setAttribute("fill-opacity", fillOpacity); svg.append(path);
    });
    geometry.paths.forEach((pathData) => {
      const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", pathData); path.setAttribute("fill", "none"); path.setAttribute("stroke", color); path.setAttribute("stroke-opacity", lineOpacity); path.setAttribute("stroke-width", "1.2"); path.setAttribute("vector-effect", "non-scaling-stroke"); svg.append(path);
    });
    return svg;
  }

  _renderDetail(detail) {
    const state = this._hass?.states?.[detail.entity];
    const presentation = detailPresentation(state, detail);
    const name = detail.name ?? state?.attributes?.friendly_name ?? detail.entity;
    const iconName = detail.icon ?? state?.attributes?.icon;
    const showIcon = detail.show_icon ?? this._config.show_icons;
    const node = this._interactive("div", detail.entity, `${name}: ${presentation.label}`);
    node.className = "detail"; node.style.setProperty("--detail-color", presentation.color); node.title = `${name}: ${presentation.label}`;
    if (showIcon && iconName) {
      if (iconName === "mdi:circle" || iconName === "dot") { const dot = document.createElement("span"); dot.className = "dot"; dot.setAttribute("aria-hidden", "true"); node.append(dot); }
      else { const icon = document.createElement("ha-icon"); icon.className = "detail-icon"; icon.setAttribute("icon", iconName); icon.setAttribute("aria-hidden", "true"); node.append(icon); }
    }
    const text = document.createElement("span"); text.className = "detail-text";
    if (detail.show_name) { const label = document.createElement("span"); label.className = "detail-name"; label.textContent = name; text.append(label); }
    text.append(document.createTextNode(presentation.label)); node.append(text);
    return node;
  }

  _interactive(tag, entityId, label) {
    const node = document.createElement(tag); node.tabIndex = 0; node.setAttribute("role", "button"); node.setAttribute("aria-label", label);
    const open = () => this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    node.addEventListener("click", open);
    node.addEventListener("keydown", (event) => { if (isActivationKey(event)) { event.preventDefault(); open(); } });
    return node;
  }
}

const EDITOR_STYLE = `
  :host { display:block; } .form { display:grid; gap:12px; padding:8px 0; }
  label { display:grid; gap:5px; color:var(--primary-text-color); font-size:13px; }
  input, select, button { box-sizing:border-box; min-height:40px; padding:8px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:6px; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .list { display:grid; gap:8px; }
  .item { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto; gap:6px; align-items:end; }
  h4 { margin:8px 0 0; } button { cursor:pointer; }
`;

export class CompactSystemStatusCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this._render(); }
  setConfig(config) { this._config = structuredClone(config); this._render(); }
  _emit(config) { this._config = config; this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config } })); this._render(); }
  _render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = `<style>${EDITOR_STYLE}</style><div class="form"><label>Title<input data-key="title" value="${this._escape(this._config.title || "")}"></label><div class="row"><label>Layout<select data-key="layout"><option value="two-row">Two row</option><option value="single-row">Single row</option></select></label><label>History hours<input data-key="hours_to_show" type="number" min="0.25" step="0.25" value="${this._config.hours_to_show ?? 6}"></label></div><label><span><input data-key="show_title" type="checkbox" ${this._config.show_title ? "checked" : ""}> Show title</span></label><label><span><input data-key="show_icons" type="checkbox" ${this._config.show_icons ? "checked" : ""}> Show icons by default</span></label><h4>Metrics</h4><div class="list metrics"></div><button class="add-metric">Add metric</button><h4>Details</h4><div class="list details"></div><button class="add-detail">Add detail</button></div>`;
    this.shadowRoot.querySelector('[data-key="layout"]').value = this._config.layout || "two-row";
    this._renderItems("metrics", this._config.metrics || []);
    this._renderItems("details", this._config.details || []);
    this.shadowRoot.querySelectorAll("[data-key]").forEach((input) => input.addEventListener("change", () => {
      const config = structuredClone(this._config); const key = input.dataset.key;
      config[key] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value || (key === "title" ? null : input.value); this._emit(config);
    }));
    this.shadowRoot.querySelector(".add-metric").onclick = () => this._add("metrics");
    this.shadowRoot.querySelector(".add-detail").onclick = () => this._add("details");
  }
  _renderItems(kind, items) {
    const list = this.shadowRoot.querySelector(`.${kind}`);
    items.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "item";
      const picker = document.createElement("ha-entity-picker"); picker.hass = this._hass; picker.value = item.entity || ""; picker.label = "Entity"; picker.allowCustomEntity = true;
      picker.addEventListener("value-changed", (event) => this._changeItem(kind, index, "entity", event.detail.value));
      const name = document.createElement("input"); name.placeholder = "Display name (optional)"; name.value = item.name || ""; name.onchange = () => this._changeItem(kind, index, "name", name.value || undefined);
      const remove = document.createElement("button"); remove.textContent = "Remove"; remove.onclick = () => { const config = structuredClone(this._config); config[kind].splice(index, 1); this._emit(config); };
      row.append(picker, name, remove); list.append(row);
    });
  }
  _add(kind) { const config = structuredClone(this._config); config[kind] ||= []; config[kind].push({ entity: "sensor.example" }); this._emit(config); }
  _changeItem(kind, index, key, value) { const config = structuredClone(this._config); if (value === undefined) delete config[kind][index][key]; else config[kind][index][key] = value; this._emit(config); }
  _escape(value) { return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"); }
}

if (!customElements.get("compact-system-status-card")) customElements.define("compact-system-status-card", CompactSystemStatusCard);
if (!customElements.get("compact-system-status-card-editor")) customElements.define("compact-system-status-card-editor", CompactSystemStatusCardEditor);
