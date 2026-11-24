import {
  appendCurrentPoint, colorForValue, downsamplePoints, graphBounds, historyRequest,
  parseHistoryStates, sparklineGeometry,
} from "./compact-system-status-data.js";
import { formatMetricValue, mergeMultiMetricGraphConfig } from "./multi-metric-graph-data.js";

const STYLE = `
  :host { display:block; width:100%; height:auto; container-type:inline-size; }
  ha-card { display:block; width:100%; box-sizing:border-box; overflow:hidden; color:var(--primary-text-color); background:var(--ha-card-background, var(--card-background-color)); }
  ha-card.fixed-height { height:var(--card-height); display:flex; flex-direction:column; }
  .title { padding:14px 16px 8px; font-size:16px; line-height:20px; font-weight:600; text-align:left; }
  .metrics { display:grid; grid-template-columns:repeat(var(--columns), minmax(0, 1fr)); min-width:0; }
  .fixed-height .metrics { flex:1 1 auto; min-height:0; grid-auto-rows:minmax(0, 1fr); }
  .metric { min-width:0; position:relative; display:flex; flex-direction:column; cursor:pointer; outline:none; overflow:hidden; }
  .metric:not(:first-child) { border-left:1px solid var(--divider-color, rgba(127,127,127,.18)); }
  .metric.column-start { border-left:0; }
  .metric.new-row { border-top:1px solid var(--divider-color, rgba(127,127,127,.18)); }
  .metric:focus-visible { box-shadow:inset 0 0 0 2px var(--primary-color); border-radius:8px; z-index:1; }
  .info { min-width:0; min-height:58px; box-sizing:border-box; display:grid; grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr); align-items:center; column-gap:8px; padding:10px 12px 7px; }
  .label { min-width:0; display:flex; align-items:center; gap:6px; justify-self:stretch; color:var(--secondary-text-color); }
  .icon { flex:0 0 auto; width:20px; height:20px; --mdc-icon-size:20px; }
  .name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; text-align:left; }
  .value { grid-column:2; justify-self:center; white-space:nowrap; text-align:center; font-size:var(--ha-font-size-xl, 24px); line-height:1.1; font-weight:500; font-variant-numeric:tabular-nums; }
  .balance { grid-column:3; }
  .chart { position:relative; height:var(--graph-height); min-height:0; margin:0 8px 8px; overflow:hidden; }
  .fixed-height .metric { min-height:0; }
  .fixed-height .chart { height:auto; flex:1 1 auto; }
  .graph { display:block; width:100%; height:100%; pointer-events:none; }
  .empty { position:absolute; inset:0; display:grid; place-items:center; color:var(--secondary-text-color); font-size:11px; opacity:.65; }
  @container (max-width:420px) {
    .metrics { grid-template-columns:1fr; }
    .metric:not(:first-child) { border-left:0; border-top:1px solid var(--divider-color, rgba(127,127,127,.18)); }
  }
`;

const isActivationKey = (event) => event.key === "Enter" || event.key === " ";

export class MultiMetricGraphCard extends HTMLElement {
  static getStubConfig() {
    return {
      columns: 3,
      metrics: [
        { entity: "sensor.speedtest_download", name: "Download", icon: "mdi:download", unit: "Mbps", min: 0 },
        { entity: "sensor.speedtest_upload", name: "Upload", icon: "mdi:upload", unit: "Mbps", min: 0 },
        { entity: "sensor.speedtest_ping", name: "Ping", icon: "mdi:timer-outline", unit: "ms", min: 0 },
      ],
    };
  }

  static async getConfigElement() { return document.createElement("multi-metric-graph-card-editor"); }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._history = new Map();
    this._historyErrors = new Map();
    this._generation = 0;
  }

  setConfig(config) {
    this._config = mergeMultiMetricGraphConfig(config);
    this._render();
    if (this.isConnected && this._hass) this._restartHistory(true);
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
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
    if (!this._config) return 3;
    if (this._config.card_height) return Math.max(1, Math.ceil(this._config.card_height / 50));
    const rows = Math.ceil(this._config.metrics.length / this._config.columns);
    return Math.max(1, Math.ceil((rows * (this._config.graph_height + 66) + (this._config.show_title && this._config.title ? 42 : 0)) / 50));
  }

  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 3, min_rows: 2 }; }

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
    const graphMetrics = this._config.metrics.filter((metric) => metric.show_graph ?? this._config.show_graphs);
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
      return { entityIds, startMs: start.getTime(), endMs: end.getTime(), response };
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
          this._history.set(entityId, { points: parseHistoryStates(response?.[entityId], startMs, endMs) });
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
    const style = document.createElement("style"); style.textContent = STYLE;
    const card = document.createElement("ha-card");
    card.style.setProperty("--columns", this._config.columns);
    card.style.setProperty("--graph-height", `${this._config.graph_height}px`);
    if (this._config.card_height) {
      card.classList.add("fixed-height");
      card.style.setProperty("--card-height", `${this._config.card_height}px`);
    }
    if (this._config.show_title && this._config.title) {
      const title = document.createElement("div"); title.className = "title"; title.textContent = this._config.title; card.append(title);
    }
    const metrics = document.createElement("div"); metrics.className = "metrics";
    this._config.metrics.forEach((metric, index) => {
      const node = this._renderMetric(metric);
      if (index % this._config.columns === 0) node.classList.add("column-start");
      if (index >= this._config.columns) node.classList.add("new-row");
      metrics.append(node);
    });
    card.append(metrics);
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
    const node = this._interactive(metric.entity, `${name}: ${formatted.full}`);
    node.className = "metric"; node.title = `${name}: ${formatted.full} · ${hours} hour history`;

    const info = document.createElement("div"); info.className = "info";
    const label = document.createElement("div"); label.className = "label";
    if (showIcon && iconName) {
      const icon = document.createElement("ha-icon"); icon.className = "icon"; icon.setAttribute("icon", iconName); icon.style.color = color; icon.setAttribute("aria-hidden", "true"); label.append(icon);
    }
    const nameNode = document.createElement("span"); nameNode.className = "name"; nameNode.textContent = name; label.append(nameNode);
    const value = document.createElement("span"); value.className = "value"; value.textContent = formatted.text; value.style.color = color;
    const balance = document.createElement("span"); balance.className = "balance"; balance.setAttribute("aria-hidden", "true");
    info.append(label, value, balance); node.append(info);

    const chart = document.createElement("div"); chart.className = "chart";
    if (metric.show_graph ?? this._config.show_graphs) chart.append(this._renderGraph(metric, state, color));
    node.append(chart);
    return node;
  }

  _renderGraph(metric, state, color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "graph"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
    const history = this._history.get(metric.entity);
    if (!history) return svg;
    const endMs = Date.now();
    const startMs = endMs - (metric.hours_to_show ?? this._config.hours_to_show) * 3600000;
    const points = downsamplePoints(appendCurrentPoint(history.points.filter((point) => point.time >= startMs), state, endMs), 100);
    const bounds = graphBounds(points, metric.min, metric.max);
    const geometry = sparklineGeometry(points, { startMs, endMs, ...bounds, width: 100, height: 100 });
    const lineOpacity = metric.graph_opacity ?? this._config.graph_opacity;
    const fillOpacity = metric.graph_fill_opacity ?? this._config.graph_fill_opacity;
    geometry.fills.forEach((pathData) => {
      const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", pathData); path.setAttribute("fill", color); path.setAttribute("fill-opacity", fillOpacity); svg.append(path);
    });
    geometry.paths.forEach((pathData) => {
      const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", pathData); path.setAttribute("fill", "none"); path.setAttribute("stroke", color); path.setAttribute("stroke-opacity", lineOpacity); path.setAttribute("stroke-width", "1.5"); path.setAttribute("vector-effect", "non-scaling-stroke"); svg.append(path);
    });
    return svg;
  }

  _interactive(entityId, label) {
    const node = document.createElement("div"); node.tabIndex = 0; node.setAttribute("role", "button"); node.setAttribute("aria-label", label);
    const open = () => this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    node.addEventListener("click", open);
    node.addEventListener("keydown", (event) => { if (isActivationKey(event)) { event.preventDefault(); open(); } });
    return node;
  }
}

const EDITOR_STYLE = `
  :host { display:block; } .form { display:grid; gap:12px; padding:8px 0; }
  label { display:grid; gap:5px; color:var(--primary-text-color); font-size:13px; }
  input, button { box-sizing:border-box; min-height:40px; padding:8px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:6px; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .list { display:grid; gap:8px; }
  .item { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto; gap:6px; align-items:end; }
  h4 { margin:8px 0 0; } button { cursor:pointer; }
`;

export class MultiMetricGraphCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this._render(); }
  setConfig(config) { this._config = structuredClone(config); this._render(); }
  _emit(config) { this._config = config; this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config } })); this._render(); }
  _render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = `<style>${EDITOR_STYLE}</style><div class="form"><label>Title<input data-key="title" value="${this._escape(this._config.title || "")}"></label><div class="row"><label>Columns<input data-key="columns" type="number" min="1" max="12" value="${this._config.columns ?? 3}"></label><label>Card height (optional)<input data-key="card_height" type="number" min="120" max="1000" placeholder="Automatic" value="${this._config.card_height ?? ""}"></label></div><div class="row"><label>Graph height<input data-key="graph_height" type="number" min="60" max="300" value="${this._config.graph_height ?? 120}"></label><label>History hours<input data-key="hours_to_show" type="number" min="0.25" step="0.25" value="${this._config.hours_to_show ?? 24}"></label></div><div class="row"><label><span><input data-key="show_icons" type="checkbox" ${this._config.show_icons ? "checked" : ""}> Show icons</span></label><label><span><input data-key="show_title" type="checkbox" ${this._config.show_title ? "checked" : ""}> Show title</span></label></div><h4>Metrics</h4><div class="list metrics"></div><button class="add-metric">Add metric</button></div>`;
    this._renderItems(this._config.metrics || []);
    this.shadowRoot.querySelectorAll("[data-key]").forEach((input) => input.addEventListener("change", () => {
      const config = structuredClone(this._config); const key = input.dataset.key;
      config[key] = input.type === "checkbox" ? input.checked : input.type === "number" ? (key === "card_height" && input.value === "" ? null : Number(input.value)) : input.value || (key === "title" ? null : input.value); this._emit(config);
    }));
    this.shadowRoot.querySelector(".add-metric").onclick = () => { const config = structuredClone(this._config); config.metrics ||= []; config.metrics.push({ entity: "sensor.example" }); this._emit(config); };
  }
  _renderItems(items) {
    const list = this.shadowRoot.querySelector(".metrics");
    items.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "item";
      const picker = document.createElement("ha-entity-picker"); picker.hass = this._hass; picker.value = item.entity || ""; picker.label = "Entity"; picker.allowCustomEntity = true;
      picker.addEventListener("value-changed", (event) => this._changeItem(index, "entity", event.detail.value));
      const name = document.createElement("input"); name.placeholder = "Display name (optional)"; name.value = item.name || ""; name.onchange = () => this._changeItem(index, "name", name.value || undefined);
      const remove = document.createElement("button"); remove.textContent = "Remove"; remove.onclick = () => { const config = structuredClone(this._config); config.metrics.splice(index, 1); this._emit(config); };
      row.append(picker, name, remove); list.append(row);
    });
  }
  _changeItem(index, key, value) { const config = structuredClone(this._config); if (value === undefined) delete config.metrics[index][key]; else config.metrics[index][key] = value; this._emit(config); }
  _escape(value) { return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"); }
}

if (!customElements.get("multi-metric-graph-card")) customElements.define("multi-metric-graph-card", MultiMetricGraphCard);
if (!customElements.get("multi-metric-graph-card-editor")) customElements.define("multi-metric-graph-card-editor", MultiMetricGraphCardEditor);
