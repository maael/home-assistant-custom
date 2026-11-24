import { formatMetricValue } from "./compact-system-status-data.js";

export const DEFAULT_MULTI_METRIC_GRAPH_CONFIG = Object.freeze({
  title: null,
  show_title: false,
  columns: 3,
  stack_on_narrow: false,
  graph_height: 120,
  card_height: null,
  hours_to_show: 24,
  refresh_interval: 60,
  show_icons: false,
  show_names: true,
  show_graphs: true,
  graph_opacity: 0.8,
  graph_fill_opacity: 0.14,
  value_position: "right",
  value_size: null,
  metrics: [],
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback, min, max, integer = false) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = clamp(parsed, min, max);
  return integer ? Math.round(bounded) : bounded;
};

export function mergeMultiMetricGraphConfig(config) {
  if (!isObject(config)) throw new Error("Multi Metric Graph Card configuration must be an object.");
  if (!Array.isArray(config.metrics) || config.metrics.length === 0) throw new Error("metrics must be a non-empty array.");
  const merged = {
    ...DEFAULT_MULTI_METRIC_GRAPH_CONFIG,
    ...config,
    metrics: config.metrics.map((metric, index) => normalizeMetric(metric, index)),
  };
  if (merged.title !== null && typeof merged.title !== "string") throw new Error("title must be a string or null.");
  merged.show_title = Boolean(merged.show_title);
  merged.stack_on_narrow = Boolean(merged.stack_on_narrow);
  merged.show_icons = Boolean(merged.show_icons);
  merged.show_names = Boolean(merged.show_names);
  merged.show_graphs = Boolean(merged.show_graphs);
  merged.columns = number(merged.columns, 3, 1, 12, true);
  merged.graph_height = number(merged.graph_height, 120, 16, 300, true);
  if (merged.card_height !== null && merged.card_height !== undefined && merged.card_height !== "") {
    if (!Number.isFinite(Number(merged.card_height))) throw new Error("card_height must be numeric or null.");
    merged.card_height = number(merged.card_height, 220, 60, 1000, true);
  } else merged.card_height = null;
  merged.hours_to_show = number(merged.hours_to_show, 24, 0.25, 720);
  merged.refresh_interval = number(merged.refresh_interval, 60, 10, 3600);
  merged.graph_opacity = number(merged.graph_opacity, 0.8, 0, 1);
  merged.graph_fill_opacity = number(merged.graph_fill_opacity, 0.14, 0, 1);
  if (!["right", "center"].includes(merged.value_position)) throw new Error("value_position must be 'right' or 'center'.");
  merged.value_size = optionalSize(merged.value_size, "value_size");
  return merged;
}

function normalizeMetric(metric, index) {
  if (!isObject(metric)) throw new Error(`metrics[${index}] must be an object.`);
  if (typeof metric.entity !== "string" || !metric.entity.includes(".")) throw new Error(`metrics[${index}].entity must be an entity ID.`);
  const normalized = { ...metric };
  normalized.decimals = number(metric.decimals, 0, 0, 6, true);
  normalized.hours_to_show = metric.hours_to_show === undefined ? undefined : number(metric.hours_to_show, 24, 0.25, 720);
  normalized.show_icon = metric.show_icon === undefined ? undefined : Boolean(metric.show_icon);
  normalized.show_name = metric.show_name === undefined ? undefined : Boolean(metric.show_name);
  normalized.show_graph = metric.show_graph === undefined ? undefined : Boolean(metric.show_graph);
  normalized.graph_opacity = metric.graph_opacity === undefined ? undefined : number(metric.graph_opacity, 0.8, 0, 1);
  normalized.graph_fill_opacity = metric.graph_fill_opacity === undefined ? undefined : number(metric.graph_fill_opacity, 0.14, 0, 1);
  if (metric.value_position !== undefined && !["right", "center"].includes(metric.value_position)) throw new Error(`metrics[${index}].value_position must be 'right' or 'center'.`);
  normalized.value_position = metric.value_position;
  normalized.value_size = optionalSize(metric.value_size, `metrics[${index}].value_size`);
  for (const bound of ["min", "max"]) {
    if (metric[bound] !== undefined && !Number.isFinite(Number(metric[bound]))) throw new Error(`metrics[${index}].${bound} must be numeric.`);
    if (metric[bound] !== undefined) normalized[bound] = Number(metric[bound]);
  }
  if (normalized.min !== undefined && normalized.max !== undefined && normalized.min >= normalized.max) throw new Error(`metrics[${index}].min must be less than max.`);
  normalized.color_thresholds = normalizeThresholds(metric.color_thresholds, `metrics[${index}].color_thresholds`);
  return normalized;
}

function optionalSize(value, path) {
  if (value === undefined || value === null || value === "") return undefined;
  if (!Number.isFinite(Number(value))) throw new Error(`${path} must be numeric or null.`);
  return number(value, 24, 8, 96, true);
}

function normalizeThresholds(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((entry, index) => {
    if (!isObject(entry) || !Number.isFinite(Number(entry.value)) || typeof entry.color !== "string") throw new Error(`${path}[${index}] requires numeric value and color.`);
    return { value: Number(entry.value), color: entry.color };
  }).sort((a, b) => a.value - b.value);
}

export { formatMetricValue };
