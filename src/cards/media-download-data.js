export const DEFAULT_CONFIG = Object.freeze({
  title: "Media Downloads",
  radarr: { action: "get_queue", service_data: {} },
  sonarr: { action: "get_queue", service_data: {} },
  qbittorrent: { action: "get_torrents", service_data: {}, download_speed_entity: null },
  appearance: {
    columns: 4, rows: 2, gap: 8, border_radius: 8, show_title: false,
    show_episode: true, show_eta: true, show_summary: true,
    progress_colour: "#4CAF50", progress_bar_height: 5,
    progress_text_size: 16, progress_decimals: 1,
    progress_text_background: "rgba(0, 0, 0, 0.65)",
    grayscale_inactive: true, inactive_opacity: 0.65, show_pause_icon: true,
  },
  behaviour: {
    refresh_interval: 10, sort_active_first: true, hide_completed: true,
    hide_inactive: false, scrollable: true,
  },
});

const ACTIVE_STATES = new Set(["downloading", "forceddl"]);
const COMPLETED_STATES = new Set(["uploading", "forcedup", "stalledup", "queuedup", "pausedup", "stoppedup", "completed", "seeding"]);
const ERROR_STATES = new Set(["error", "missingfiles"]);
const STATUS_LABELS = {
  downloading: "Downloading", forceddl: "Downloading", stalleddl: "Stalled",
  queueddl: "Queued", pauseddl: "Paused", stoppeddl: "Stopped",
  checkingdl: "Checking", metadl: "Fetching metadata", error: "Error",
  missingfiles: "Missing files",
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mergeConfig(config = {}) {
  if (!isObject(config)) throw new Error("Media Download Card configuration must be an object.");
  const merged = {
    ...DEFAULT_CONFIG,
    ...config,
    radarr: mergeSource(DEFAULT_CONFIG.radarr, config.radarr),
    sonarr: mergeSource(DEFAULT_CONFIG.sonarr, config.sonarr),
    qbittorrent: mergeSource(DEFAULT_CONFIG.qbittorrent, config.qbittorrent),
    appearance: { ...DEFAULT_CONFIG.appearance, ...(config.appearance || {}) },
    behaviour: { ...DEFAULT_CONFIG.behaviour, ...(config.behaviour || {}) },
  };
  const number = (value, fallback, min, max, integer = false) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const bounded = clamp(parsed, min, max);
    return integer ? Math.round(bounded) : bounded;
  };
  const a = merged.appearance;
  a.columns = number(a.columns, 4, 1, 12, true);
  a.rows = number(a.rows, 2, 0, 100, true);
  a.gap = number(a.gap, 8, 0, 48);
  a.border_radius = number(a.border_radius, 8, 0, 64);
  a.progress_bar_height = number(a.progress_bar_height, 5, 1, 24);
  a.progress_text_size = number(a.progress_text_size, 16, 8, 48);
  a.progress_decimals = number(a.progress_decimals, 1, 0, 3, true);
  a.inactive_opacity = number(a.inactive_opacity, 0.65, 0.1, 1);
  merged.behaviour.refresh_interval = number(merged.behaviour.refresh_interval, 10, 2, 3600);
  const speedEntity = merged.qbittorrent.download_speed_entity;
  if (speedEntity !== null && speedEntity !== undefined && (typeof speedEntity !== "string" || !speedEntity.startsWith("sensor."))) {
    throw new Error("qbittorrent.download_speed_entity must be a sensor entity ID.");
  }
  return merged;
}

function mergeSource(defaults, source) {
  if (source !== undefined && !isObject(source)) throw new Error("Integration settings must be objects.");
  const merged = { ...defaults, ...(source || {}) };
  if (typeof merged.action !== "string" || !merged.action.trim()) throw new Error("Each integration action must be a non-empty string.");
  if (!isObject(merged.service_data)) throw new Error("service_data must be an object.");
  return merged;
}

export function normalizeHash(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function collectionValues(collection) {
  if (Array.isArray(collection)) return collection.filter(isObject);
  if (isObject(collection)) return Object.entries(collection).map(([key, value]) => isObject(value) ? ({ _release_key: key, ...value }) : null).filter(Boolean);
  throw new Error("The action response collection is neither a mapping nor an array.");
}

export function extractCollection(response, key) {
  const queue = [response];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!isObject(current) || seen.has(current)) continue;
    seen.add(current);
    if (Object.prototype.hasOwnProperty.call(current, key)) return collectionValues(current[key]);
    for (const wrapper of ["response", "result", "data", "service_response"]) {
      if (isObject(current[wrapper])) queue.unshift(current[wrapper]);
    }
    for (const value of Object.values(current)) if (isObject(value)) queue.push(value);
  }
  throw new Error(`Action response did not contain the required '${key}' collection.`);
}

export function parsePercent(value) {
  if (typeof value === "string") value = value.trim().replace(/%$/, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : null;
}

function arrProgress(record) {
  const direct = parsePercent(record.progress);
  if (direct !== null) return direct;
  const size = Number(record.size);
  const left = Number(record.size_left);
  return Number.isFinite(size) && size > 0 && Number.isFinite(left)
    ? clamp(((size - left) / size) * 100, 0, 100) : null;
}

export function parseEta(value) {
  if (value === null || value === undefined || value === "" || String(value).trim().toLowerCase() === "none") return null;
  let seconds;
  if (typeof value === "number") seconds = value;
  else {
    const match = String(value).trim().match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return null;
    seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 365 * 86400 ? seconds : null;
}

export function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unknown ETA";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days) return `${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  if (minutes) return `${minutes}m${secs ? ` ${secs}s` : ""}`;
  return `${secs}s`;
}

export function torrentDownloadSpeed(torrent = {}) {
  const speedFields = ["download_speed", "downloadSpeed", "dlspeed", "dl_speed", "speed"];
  for (const field of speedFields) {
    if (torrent[field] !== undefined && torrent[field] !== null && torrent[field] !== "") {
      const candidate = Number(torrent[field]);
      if (Number.isFinite(candidate) && candidate >= 0) return candidate;
    }
  }
  return null;
}

export function totalTorrentDownloadSpeed(torrents = []) {
  const speeds = torrents.map(torrentDownloadSpeed).filter((speed) => speed !== null);
  return speeds.length ? speeds.reduce((total, speed) => total + speed, 0) : null;
}

export function formatDataRate(bytesPerSecond) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 0) return null;
  const units = ["B/s", "kB/s", "MB/s", "GB/s", "TB/s"];
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  const decimals = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

export function classifyTorrent(torrent = {}) {
  const raw = String(torrent.status ?? torrent.state ?? "").trim();
  const state = raw.toLowerCase();
  const speed = torrentDownloadSpeed(torrent);
  const completed = COMPLETED_STATES.has(state);
  const error = ERROR_STATES.has(state) || state.includes("error");
  const stateActive = ACTIVE_STATES.has(state);
  const active = stateActive && speed !== 0;
  let kind = "unknown";
  if (active) kind = "active";
  else if (error) kind = "error";
  else if (state === "stalleddl") kind = "stalled";
  else if (state === "queueddl") kind = "queued";
  else if (state === "pauseddl" || state === "stoppeddl") kind = "paused";
  else if (state === "checkingdl" || state === "metadl") kind = "pending";
  else if (completed) kind = "completed";
  else if (stateActive && speed === 0) kind = "stalled";
  return { raw, state, speed, active, completed, error, kind, label: STATUS_LABELS[state] || (raw ? `Unknown (${raw})` : "Unknown status") };
}

function imageUrl(record) {
  const candidate = record?.images?.poster ?? record?.poster ?? record?.image;
  if (typeof candidate !== "string") return null;
  try {
    const url = new URL(candidate, globalThis.location?.origin || "http://localhost");
    return ["http:", "https:"].includes(url.protocol) ? candidate : null;
  } catch { return null; }
}

function episodePart(record) {
  const season = Number(record.season_number);
  if (!Number.isInteger(season) || season < 0) return null;
  if (record.is_full_season === true || (record.is_season_pack === true && !record.episode_range && !record.episode_identifier)) return `Season ${season}`;
  const range = String(record.episode_range || "").match(/E(\d+)(?:\s*[-–]\s*E?(\d+))?/i);
  if (range) return `S${String(season).padStart(2, "0")}E${String(Number(range[1])).padStart(2, "0")}${range[2] ? `–${String(Number(range[2])).padStart(2, "0")}` : ""}`;
  const identifier = String(record.episode_identifier || "").match(/S(\d+)E(\d+)(?:\s*[-–]\s*E?(\d+))?/i);
  if (identifier) return `S${String(Number(identifier[1])).padStart(2, "0")}E${String(Number(identifier[2])).padStart(2, "0")}${identifier[3] ? `–${String(Number(identifier[3])).padStart(2, "0")}` : ""}`;
  const episode = Number(record.episode_number);
  return Number.isInteger(episode) ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : (record.is_season_pack ? `Season ${season}` : null);
}

function addArrRecords(map, records, type) {
  for (const record of records) {
    const hash = normalizeHash(record.download_id ?? record.downloadId ?? record.torrent_id ?? record.hash);
    if (!hash) continue;
    let item = map.get(hash);
    if (!item) {
      item = { hash, type, title: String(record.title || record._release_key || "Unknown media"), artwork: imageUrl(record), arr: [], episodeParts: new Set() };
      map.set(hash, item);
    }
    item.arr.push(record);
    if (!item.artwork) item.artwork = imageUrl(record);
    const episode = type === "tv" ? episodePart(record) : null;
    if (episode) item.episodeParts.add(episode);
  }
}

export function buildMediaDownloads({ movies = [], shows = [], torrents = [] }, behaviour = DEFAULT_CONFIG.behaviour) {
  const byHash = new Map();
  addArrRecords(byHash, movies, "movie");
  addArrRecords(byHash, shows, "tv");
  const torrentMap = new Map(torrents.map((torrent) => [normalizeHash(torrent.id ?? torrent.hash ?? torrent.download_id), torrent]).filter(([hash]) => hash));
  let items = [...byHash.values()].map((item) => {
    const torrent = torrentMap.get(item.hash);
    const status = torrent ? classifyTorrent(torrent) : { active: false, completed: false, error: false, kind: "unknown", label: "Unknown status", speed: null };
    const qbProgress = torrent ? parsePercent(torrent.percent_done ?? torrent.progress ?? torrent.percentage) : null;
    const fallbackProgress = item.arr.map(arrProgress).find((value) => value !== null) ?? 0;
    const progress = qbProgress ?? fallbackProgress;
    const torrentEta = torrent ? parseEta(torrent.eta ?? torrent.time_left) : null;
    const arrEta = item.arr.map((record) => parseEta(record.time_left)).find((value) => value !== null) ?? null;
    const completed = status.completed || progress >= 100;
    return {
      hash: item.hash, type: item.type, title: item.title, artwork: item.artwork,
      episode: [...item.episodeParts].sort().join(", "), progress,
      eta: torrentEta ?? arrEta, matched: Boolean(torrent), completed,
      ...status,
    };
  });
  if (behaviour.hide_completed !== false) items = items.filter((item) => !item.completed);
  if (behaviour.hide_inactive === true) items = items.filter((item) => item.active);
  items.sort((a, b) => {
    if (behaviour.sort_active_first !== false && a.active !== b.active) return a.active ? -1 : 1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.hash.localeCompare(b.hash);
  });
  return items;
}

export function serviceCallMessage(domain, source) {
  const serviceData = { ...source.service_data };
  if (source.entry_id !== undefined && serviceData.entry_id === undefined) serviceData.entry_id = source.entry_id;
  return { type: "call_service", domain, service: source.action, service_data: serviceData, return_response: true };
}
