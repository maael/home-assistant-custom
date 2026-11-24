import {
  buildMediaDownloads, extractCollection, formatDataRate, formatEta, mergeConfig,
  serviceCallMessage, totalTorrentDownloadSpeed,
} from "./media-download-data.js";

const STYLE = `
  :host { display:block; container-type:inline-size; }
  ha-card { overflow:hidden; }
  .header { display:flex; align-items:baseline; gap:12px; padding:16px 16px 8px; white-space:nowrap; }
  .heading { flex:0 0 auto; font-size:var(--ha-card-header-font-size, 20px); font-weight:500; color:var(--primary-text-color); }
  .summary { min-width:0; flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; font-size:12px; color:var(--secondary-text-color); text-align:right; }
  .stale { color:var(--warning-color, #ff9800); font-weight:600; }
  .message { padding:16px; color:var(--secondary-text-color); }
  .message.error { color:var(--error-color, #db4437); }
  .grid { display:grid; grid-template-columns:repeat(var(--columns), minmax(0, 1fr)); gap:var(--gap); padding:8px 16px 16px; overflow-x:hidden; scrollbar-gutter:stable; }
  .grid.scrollable { overflow-y:auto; }
  .item { min-width:0; color:var(--primary-text-color); }
  .poster { position:relative; width:100%; aspect-ratio:2 / 3; overflow:hidden; border-radius:var(--radius); background:var(--secondary-background-color, #555); }
  .poster img { display:block; width:100%; height:100%; object-fit:cover; }
  .item.inactive .poster img { filter:var(--inactive-filter); opacity:var(--inactive-opacity); }
  .fallback { position:absolute; inset:0; display:grid; place-items:center; padding:8px; text-align:center; color:var(--secondary-text-color); font-weight:600; background:linear-gradient(145deg, var(--secondary-background-color), var(--card-background-color)); }
  .progress-text { position:absolute; left:50%; bottom:calc(var(--bar-height) + 7px); transform:translateX(-50%); z-index:3; padding:2px 6px; border-radius:6px; color:white; background:var(--progress-bg); box-shadow:0 1px 4px rgba(0,0,0,.55); font-size:var(--progress-size); font-weight:700; white-space:nowrap; }
  .progress-track { position:absolute; z-index:3; left:0; right:0; bottom:0; height:var(--bar-height); background:rgba(128,128,128,.45); }
  .progress-fill { height:100%; background:var(--progress-colour); }
  .item.inactive .progress-fill { background:var(--disabled-text-color, #888); }
  .state-icon { position:absolute; z-index:2; inset:0; display:grid; place-items:center; color:white; font-size:30px; font-weight:700; text-shadow:0 1px 5px #000; pointer-events:none; }
  .title { margin-top:5px; font-size:13px; line-height:16px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .episode, .eta { min-height:17px; margin-top:3px; font-size:12px; line-height:14px; text-align:center; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .eta.error { color:var(--error-color, #db4437); font-weight:600; }
  @container (max-width: 360px) { .grid { padding-left:10px; padding-right:10px; } .progress-text { font-size:min(var(--progress-size), 13px); } }
`;

const ICONS = { paused: "Ⅱ", stalled: "!", queued: "…", pending: "↻", error: "!", unknown: "?" };

export class MediaDownloadCard extends HTMLElement {
  static getStubConfig() { return {}; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sources = { radarr: null, sonarr: null, qbittorrent: null };
    this._errors = {};
    this._items = [];
    this._torrentSpeed = null;
    this._nodes = new Map();
    this._generation = 0;
    this._inFlight = false;
    this._loaded = false;
    this._renderShell();
  }

  setConfig(config) {
    this._config = mergeConfig(config);
    this._applyAppearance();
    this._render();
    if (this.isConnected && this._hass) this._restartPolling(true);
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first && this.isConnected && this._config) this._restartPolling(true);
    else if (this._config) this._renderSummary();
  }

  connectedCallback() {
    if (this._config && this._hass) this._restartPolling(true);
    this._resizeObserver ||= new ResizeObserver(() => this._setGridHeight());
    this._resizeObserver.observe(this._grid);
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
    this._generation++;
    this._resizeObserver?.disconnect();
  }

  getCardSize() { return Math.max(1, (this._config?.appearance.rows || 2) * 3); }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 3 }; }

  _renderShell() {
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div class="header"><div class="heading"></div><div class="summary"></div></div><div class="message"></div><div class="grid" tabindex="0" aria-label="Media downloads"></div></ha-card>`;
    this._header = this.shadowRoot.querySelector(".header");
    this._heading = this.shadowRoot.querySelector(".heading");
    this._summary = this.shadowRoot.querySelector(".summary");
    this._message = this.shadowRoot.querySelector(".message");
    this._grid = this.shadowRoot.querySelector(".grid");
  }

  _applyAppearance() {
    if (!this._config) return;
    const a = this._config.appearance;
    const style = this.style;
    style.setProperty("--columns", a.columns);
    style.setProperty("--gap", `${a.gap}px`);
    style.setProperty("--radius", `${a.border_radius}px`);
    style.setProperty("--bar-height", `${a.progress_bar_height}px`);
    style.setProperty("--progress-size", `${a.progress_text_size}px`);
    style.setProperty("--progress-bg", a.progress_text_background);
    style.setProperty("--progress-colour", a.progress_colour);
    style.setProperty("--inactive-opacity", a.inactive_opacity);
    style.setProperty("--inactive-filter", a.grayscale_inactive ? "grayscale(1)" : "none");
    this._grid.classList.toggle("scrollable", this._config.behaviour.scrollable && a.rows > 0);
  }

  _restartPolling(immediate = false) {
    clearTimeout(this._timer);
    const generation = ++this._generation;
    if (immediate) this._refresh(generation);
    else this._schedule(generation);
  }

  _schedule(generation) {
    if (!this.isConnected || generation !== this._generation) return;
    const delay = this._config.behaviour.refresh_interval * 1000;
    this._timer = setTimeout(() => this._refresh(generation), delay);
  }

  async _refresh(generation) {
    if (!this.isConnected || generation !== this._generation || this._inFlight) return;
    if (this._hass?.connection?.connected === false) { this._schedule(generation); return; }
    this._inFlight = true;
    if (!this._loaded) this._render();
    const definitions = [
      ["radarr", "movies"], ["sonarr", "shows"], ["qbittorrent", "torrents"],
    ];
    const results = await Promise.allSettled(definitions.map(([domain]) => this._call(domain)));
    if (generation !== this._generation || !this.isConnected) { this._inFlight = false; return; }
    const nextErrors = {};
    results.forEach((result, index) => {
      const [domain, key] = definitions[index];
      if (result.status === "fulfilled") {
        try { this._sources[domain] = extractCollection(result.value, key); }
        catch (error) { nextErrors[domain] = error.message; }
      } else nextErrors[domain] = result.reason?.message || String(result.reason);
    });
    this._errors = nextErrors;
    const hasArr = this._sources.radarr !== null || this._sources.sonarr !== null;
    if (hasArr) {
      const torrents = this._sources.qbittorrent || [];
      this._items = buildMediaDownloads({
        movies: this._sources.radarr || [], shows: this._sources.sonarr || [], torrents,
      }, this._config.behaviour);
      this._torrentSpeed = totalTorrentDownloadSpeed(torrents);
      this._loaded = true;
    }
    this._inFlight = false;
    this._render();
    this._schedule(generation);
  }

  _call(domain) {
    if (!this._hass?.callWS) return Promise.reject(new Error("Home Assistant WebSocket API is unavailable."));
    return this._hass.callWS(serviceCallMessage(domain, this._config[domain]));
  }

  _render() {
    if (!this._config) return;
    const errorNames = Object.keys(this._errors);
    this._heading.textContent = this._config.title;
    this._renderSummary();
    this._header.hidden = !this._config.title && !this._config.appearance.show_summary;
    if (!this._loaded && this._inFlight) this._showMessage("Loading media downloads…");
    else if (!this._loaded && errorNames.length) this._showMessage(`Unable to load queues: ${errorNames.map((name) => `${name}: ${this._errors[name]}`).join("; ")}`, true);
    else if (!this._items.length) this._showMessage(errorNames.length ? "No downloads to show. Some queue data is stale." : "No current media downloads.");
    else { this._message.hidden = true; this._grid.hidden = false; this._renderItems(); }
  }

  _renderSummary() {
    if (!this._config) return;
    this._summary.replaceChildren();
    this._summary.title = "";
    if (!this._config.appearance.show_summary || !this._loaded) return;
    const movies = this._sources.radarr?.length || 0;
    const shows = this._sources.sonarr?.length || 0;
    const torrents = this._sources.qbittorrent?.length || 0;
    const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;
    const speed = this._downloadSpeedText() || "—";
    this._summary.append(document.createTextNode(`${plural(movies, "movie")} · ${plural(shows, "TV show")} · ${plural(torrents, "torrent")} · ↓ ${speed}`));
    const errorNames = Object.keys(this._errors);
    if (errorNames.length) {
      const stale = document.createElement("span");
      stale.className = "stale";
      stale.textContent = `Stale (${errorNames.join(", ")})`;
      this._summary.append(document.createTextNode(" · "), stale);
    }
    this._summary.title = this._summary.textContent;
  }

  _downloadSpeedText() {
    const configured = this._config.qbittorrent.download_speed_entity;
    let state = configured ? this._hass?.states?.[configured] : null;
    if (!state && !configured) {
      const candidates = Object.entries(this._hass?.states || {}).filter(([entityId, candidate]) => {
        const attributes = candidate.attributes || {};
        const text = `${entityId} ${attributes.friendly_name || ""} ${attributes.translation_key || ""}`.toLowerCase();
        return attributes.device_class === "data_rate" && /download[ _-]*speed/.test(text) && /q[ _-]*bittorrent|qbittorrent/.test(text);
      });
      if (candidates.length === 1) state = candidates[0][1];
    }
    if (state && !["unknown", "unavailable"].includes(String(state.state).toLowerCase())) {
      try {
        if (typeof this._hass?.formatEntityState === "function") return this._hass.formatEntityState(state);
      } catch { /* Fall back to the raw state and unit. */ }
      const unit = state.attributes?.unit_of_measurement;
      return `${state.state}${unit ? ` ${unit}` : ""}`;
    }
    return formatDataRate(this._torrentSpeed);
  }

  _showMessage(text, error = false) {
    this._message.hidden = false; this._grid.hidden = true;
    this._message.className = `message${error ? " error" : ""}`;
    this._message.textContent = text;
  }

  _renderItems() {
    const { appearance: a, behaviour: b } = this._config;
    const limit = !b.scrollable && a.rows > 0 ? a.columns * a.rows : this._items.length;
    const visible = this._items.slice(0, limit);
    const keep = new Set(visible.map((item) => item.hash));
    for (const [hash, node] of this._nodes) if (!keep.has(hash)) { node.remove(); this._nodes.delete(hash); }
    for (const item of visible) {
      let node = this._nodes.get(item.hash);
      if (!node) { node = this._createItem(); this._nodes.set(item.hash, node); }
      this._updateItem(node, item);
      this._grid.append(node);
    }
    requestAnimationFrame(() => this._setGridHeight());
  }

  _createItem() {
    const node = document.createElement("article");
    node.className = "item";
    node.innerHTML = `<div class="poster"><div class="fallback"></div><img><div class="state-icon" aria-hidden="true"></div><div class="progress-text"></div><div class="progress-track"><div class="progress-fill"></div></div></div><div class="title"></div><div class="episode"></div><div class="eta"></div>`;
    const img = node.querySelector("img");
    img.addEventListener("error", () => { img.hidden = true; });
    return node;
  }

  _updateItem(node, item) {
    const a = this._config.appearance;
    node.classList.toggle("inactive", !item.active);
    node.setAttribute("aria-label", `${item.title}, ${item.progress.toFixed(a.progress_decimals)} percent, ${item.active ? (item.eta === null ? "active, unknown ETA" : formatEta(item.eta)) : item.label}`);
    const img = node.querySelector("img");
    if (img.dataset.url !== (item.artwork || "")) {
      img.dataset.url = item.artwork || ""; img.hidden = !item.artwork;
      if (item.artwork) { img.alt = `${item.title} poster`; img.src = item.artwork; }
      else img.removeAttribute("src");
    }
    node.querySelector(".fallback").textContent = item.title;
    node.querySelector(".progress-text").textContent = `${item.progress.toFixed(a.progress_decimals)}%`;
    node.querySelector(".progress-fill").style.width = `${item.progress}%`;
    const icon = node.querySelector(".state-icon");
    icon.textContent = !item.active && a.show_pause_icon ? (ICONS[item.kind] || "?") : "";
    const title = node.querySelector(".title"); title.hidden = !a.show_title; title.textContent = item.title; title.title = item.title;
    const episode = node.querySelector(".episode"); episode.hidden = !a.show_episode; episode.textContent = item.type === "tv" ? item.episode : "";
    const eta = node.querySelector(".eta"); eta.hidden = !a.show_eta;
    eta.textContent = item.active ? (item.eta === null ? "Unknown ETA" : formatEta(item.eta)) : item.label;
    eta.classList.toggle("error", item.error);
  }

  _setGridHeight() {
    if (!this._config || this._grid.hidden) return;
    const rows = this._config.appearance.rows;
    if (!this._config.behaviour.scrollable || rows === 0) { this._grid.style.maxHeight = "none"; return; }
    const first = this._grid.firstElementChild;
    if (!first) return;
    const height = first.getBoundingClientRect().height;
    this._grid.style.maxHeight = `${Math.ceil(height * rows + this._config.appearance.gap * (rows - 1) + 1)}px`;
  }
}

if (!customElements.get("media-download-card")) customElements.define("media-download-card", MediaDownloadCard);
