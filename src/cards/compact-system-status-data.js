export const DEFAULT_SYSTEM_STATUS_CONFIG = Object.freeze({
  title: null,
  show_title: false,
  layout: "two-row",
  hours_to_show: 6,
  refresh_interval: 60,
  show_icons: false,
  show_graphs: true,
  graph_opacity: 0.35,
  graph_fill_opacity: 0.12,
  metrics: [],
  details: [],
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback, min, max, integer = false) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = clamp(parsed, min, max);
  return integer ? Math.round(bounded) : bounded;
};

export function mergeSystemStatusConfig(config) {
  if (!isObject(config)) throw new Error("Compact System Status Card configuration must be an object.");
  if (!Array.isArray(config.metrics) || config.metrics.length === 0) throw new Error("metrics must be a non-empty array.");
  if (config.details !== undefined && !Array.isArray(config.details)) throw new Error("details must be an array.");
  const merged = {
    ...DEFAULT_SYSTEM_STATUS_CONFIG,
    ...config,
    metrics: config.metrics.map((metric, index) => normalizeMetric(metric, index)),
    details: (config.details || []).map((detail, index) => normalizeDetail(detail, index)),
  };
  if (merged.title !== null && typeof merged.title !== "string") throw new Error("title must be a string or null.");
  if (!["two-row", "single-row"].includes(merged.layout)) throw new Error("layout must be 'two-row' or 'single-row'.");
  merged.show_title = Boolean(merged.show_title);
  merged.show_icons = Boolean(merged.show_icons);
  merged.show_graphs = Boolean(merged.show_graphs);
  merged.hours_to_show = number(merged.hours_to_show, 6, 0.25, 720);
  merged.refresh_interval = number(merged.refresh_interval, 60, 10, 3600);
  merged.graph_opacity = number(merged.graph_opacity, 0.35, 0, 1);
  merged.graph_fill_opacity = number(merged.graph_fill_opacity, 0.12, 0, 1);
  return merged;
}

function normalizeMetric(metric, index) {
  if (!isObject(metric)) throw new Error(`metrics[${index}] must be an object.`);
  if (typeof metric.entity !== "string" || !metric.entity.includes(".")) throw new Error(`metrics[${index}].entity must be an entity ID.`);
  const normalized = { ...metric };
  normalized.decimals = number(metric.decimals, 0, 0, 6, true);
  normalized.hours_to_show = metric.hours_to_show === undefined ? undefined : number(metric.hours_to_show, 6, 0.25, 720);
  normalized.show_icon = metric.show_icon === undefined ? undefined : Boolean(metric.show_icon);
  normalized.show_graph = metric.show_graph === undefined ? undefined : Boolean(metric.show_graph);
  normalized.graph_opacity = metric.graph_opacity === undefined ? undefined : number(metric.graph_opacity, 0.35, 0, 1);
  normalized.graph_fill_opacity = metric.graph_fill_opacity === undefined ? undefined : number(metric.graph_fill_opacity, 0.12, 0, 1);
  for (const bound of ["min", "max"]) {
    if (metric[bound] !== undefined && !Number.isFinite(Number(metric[bound]))) throw new Error(`metrics[${index}].${bound} must be numeric.`);
    if (metric[bound] !== undefined) normalized[bound] = Number(metric[bound]);
  }
  if (normalized.min !== undefined && normalized.max !== undefined && normalized.min >= normalized.max) throw new Error(`metrics[${index}].min must be less than max.`);
  normalized.color_thresholds = normalizeThresholds(metric.color_thresholds, `metrics[${index}].color_thresholds`);
  return normalized;
}

function normalizeDetail(detail, index) {
  if (!isObject(detail)) throw new Error(`details[${index}] must be an object.`);
  if (typeof detail.entity !== "string" || !detail.entity.includes(".")) throw new Error(`details[${index}].entity must be an entity ID.`);
  return {
    ...detail,
    show_name: detail.show_name === undefined ? false : Boolean(detail.show_name),
    show_icon: detail.show_icon === undefined ? undefined : Boolean(detail.show_icon),
    state_colors: normalizeStateMap(detail.state_colors, `details[${index}].state_colors`),
    state_labels: normalizeStateMap(detail.state_labels, `details[${index}].state_labels`),
  };
}

function normalizeThresholds(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((entry, index) => {
    if (!isObject(entry) || !Number.isFinite(Number(entry.value)) || typeof entry.color !== "string") throw new Error(`${path}[${index}] requires numeric value and color.`);
    return { value: Number(entry.value), color: entry.color };
  }).sort((a, b) => a.value - b.value);
}

function normalizeStateMap(value, path) {
  if (value === undefined) return {};
  if (!isObject(value)) throw new Error(`${path} must be an object.`);
  return Object.fromEntries(Object.entries(value).map(([key, mapped]) => [key.toLowerCase(), String(mapped)]));
}

export function numericState(state) {
  if (!state || ["unknown", "unavailable", "none", "null", ""].includes(String(state.state).trim().toLowerCase())) return null;
  const value = Number(state.state);
  return Number.isFinite(value) ? value : null;
}

export function formatMetricValue(hass, state, metric) {
  const value = numericState(state);
  const unit = metric.unit ?? state?.attributes?.unit_of_measurement ?? "";
  if (value === null) return { text: state?.state || "Unavailable", full: state?.state || "Unavailable", value: null, unit };
  const formatted = value.toLocaleString(hass?.locale?.language || undefined, {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });
  const separator = unit && !["%", "°C", "°F", "°K"].includes(unit) ? " " : "";
  return { text: `${formatted}${unit ? `${separator}${unit}` : ""}`, full: `${formatted}${unit ? `${separator}${unit}` : ""}`, value, unit };
}

export function colorForValue(value, baseColor, thresholds = []) {
  let color = baseColor || "var(--primary-color, #03a9f4)";
  if (!Number.isFinite(value)) return color;
  for (const threshold of thresholds) {
    if (value < threshold.value) break;
    color = threshold.color;
  }
  return color;
}

export function detailPresentation(state, detail) {
  const raw = state?.state ?? "unavailable";
  const key = String(raw).toLowerCase();
  return {
    raw,
    label: detail.state_labels?.[key] ?? raw,
    color: detail.state_colors?.[key] ?? detail.color ?? "var(--secondary-text-color)",
  };
}

export function historyRequest(start, end, entityIds) {
  return {
    type: "history/history_during_period",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    entity_ids: entityIds,
    minimal_response: true,
    no_attributes: true,
  };
}

function historyTimestamp(record) {
  const raw = record?.lu ?? record?.lc ?? record?.last_updated ?? record?.last_changed;
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseHistoryStates(records, startMs, endMs) {
  if (!Array.isArray(records)) return [];
  const points = [];
  let pendingGap = false;
  for (const record of records) {
    const time = historyTimestamp(record);
    const raw = record?.s ?? record?.state;
    const value = Number(raw);
    if (time === null || time < startMs - 1000 || time > endMs + 1000 || !Number.isFinite(value) || ["unknown", "unavailable", "none", ""].includes(String(raw).toLowerCase())) {
      if (points.length) pendingGap = true;
      continue;
    }
    points.push({ time: clamp(time, startMs, endMs), value, breakBefore: pendingGap });
    pendingGap = false;
  }
  points.sort((a, b) => a.time - b.time);
  return points.filter((point, index) => index === 0 || point.time !== points[index - 1].time || point.value !== points[index - 1].value);
}

export function appendCurrentPoint(points, state, now = Date.now()) {
  const value = numericState(state);
  if (value === null) return points;
  const copy = points.slice();
  const last = copy[copy.length - 1];
  if (!last || last.time < now) copy.push({ time: now, value, breakBefore: false });
  return copy;
}

export function downsamplePoints(points, maxPoints = 80) {
  if (points.length <= maxPoints || maxPoints < 4) return points.slice();
  const result = [points[0]];
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const inner = points.slice(1, -1);
  const bucketSize = inner.length / bucketCount;
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const slice = inner.slice(Math.floor(bucket * bucketSize), Math.floor((bucket + 1) * bucketSize));
    if (!slice.length) continue;
    let min = slice[0]; let max = slice[0];
    for (const point of slice) {
      if (point.value < min.value) min = point;
      if (point.value > max.value) max = point;
    }
    const selected = min.time <= max.time ? [min, max] : [max, min];
    for (const point of selected) if (result[result.length - 1] !== point) result.push(point);
  }
  result.push(points[points.length - 1]);
  const sampled = result.slice(0, maxPoints).map((point) => ({ ...point }));
  for (let index = 1; index < sampled.length; index++) {
    if (points.some((point) => point.breakBefore && point.time > sampled[index - 1].time && point.time <= sampled[index].time)) sampled[index].breakBefore = true;
  }
  return sampled;
}

export function graphBounds(points, configuredMin, configuredMax) {
  const values = points.map((point) => point.value).filter(Number.isFinite);
  let min = configuredMin ?? (values.length ? Math.min(...values) : 0);
  let max = configuredMax ?? (values.length ? Math.max(...values) : 1);
  if (min === max) {
    const padding = Math.abs(min) * 0.05 || 1;
    min -= padding; max += padding;
  } else if (configuredMin === undefined || configuredMax === undefined) {
    const padding = (max - min) * 0.08;
    if (configuredMin === undefined) min -= padding;
    if (configuredMax === undefined) max += padding;
  }
  return { min, max };
}

export function sparklineGeometry(points, { startMs, endMs, min, max, width = 100, height = 46 }) {
  if (points.length < 2 || endMs <= startMs || max <= min) return { paths: [], fills: [] };
  const x = (time) => clamp(((time - startMs) / (endMs - startMs)) * width, 0, width);
  const y = (value) => clamp(height - ((value - min) / (max - min)) * height, 0, height);
  const segments = [];
  for (const point of points) {
    if (!segments.length || point.breakBefore) segments.push([]);
    segments[segments.length - 1].push([x(point.time), y(point.value)]);
  }
  const valid = segments.filter((segment) => segment.length >= 2);
  return {
    paths: valid.map((segment) => segment.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ")),
    fills: valid.map((segment) => `${segment.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ")} L${segment.at(-1)[0].toFixed(2)},${height} L${segment[0][0].toFixed(2)},${height} Z`),
  };
}
