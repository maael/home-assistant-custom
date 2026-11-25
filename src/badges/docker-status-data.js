export const DOCKER_STATUS_DEFAULTS = Object.freeze({
  icon: "mdi:docker",
  icon_color: "#2496ed",
  total_color: "primary",
  updates_icon: "mdi:package-up",
  updates_color: "orange",
  errors_icon: "mdi:alert-circle-outline",
  errors_color: "red",
  up_to_date_icon: "mdi:check-circle-outline",
  up_to_date_color: "green",
  zero_color: "green",
  unavailable_color: "grey",
  show_icon: true,
  show_total: true,
  show_updates: true,
  show_errors: true,
  show_up_to_date: false,
  show_zero_updates: true,
  show_zero_errors: true,
  show_zero_up_to_date: true,
  show_separator: true,
  show_healthy_indicator: true,
  healthy_icon: "mdi:check-circle-outline",
  healthy_color: "green",
  tap_action: { action: "more-info" },
  hold_action: { action: "none" },
  double_tap_action: { action: "none" },
});

export const METRICS = Object.freeze([
  { key: "total", entity: "total_entity", show: "show_total", color: "total_color", label: "monitored containers" },
  { key: "updates", entity: "updates_entity", show: "show_updates", showZero: "show_zero_updates", icon: "updates_icon", color: "updates_color", label: "updates available" },
  { key: "errors", entity: "errors_entity", show: "show_errors", showZero: "show_zero_errors", icon: "errors_icon", color: "errors_color", label: "errors" },
  { key: "up_to_date", entity: "up_to_date_entity", show: "show_up_to_date", showZero: "show_zero_up_to_date", icon: "up_to_date_icon", color: "up_to_date_color", label: "up to date" },
]);

const THEME_COLORS = Object.freeze({
  primary: "var(--primary-color)",
  accent: "var(--accent-color)",
  error: "var(--error-color, var(--red-color, #f44336))",
  warning: "var(--warning-color, var(--orange-color, #ff9800))",
  success: "var(--success-color, var(--green-color, #4caf50))",
  red: "var(--red-color, #f44336)",
  orange: "var(--orange-color, #ff9800)",
  amber: "var(--amber-color, #ffc107)",
  yellow: "var(--yellow-color, #ffeb3b)",
  green: "var(--green-color, #4caf50)",
  blue: "var(--blue-color, #2196f3)",
  grey: "var(--grey-color, #9e9e9e)",
  gray: "var(--grey-color, #9e9e9e)",
  disabled: "var(--disabled-text-color, #9e9e9e)",
  secondary: "var(--secondary-text-color)",
});

export function resolveColor(value) {
  const color = String(value ?? "").trim();
  return THEME_COLORS[color.toLowerCase()] || color || "currentColor";
}

export function normalizeDockerStatusConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Docker Status Badge requires a configuration object.");
  const configuredEntities = METRICS.map((metric) => config[metric.entity]).filter((entity) => typeof entity === "string" && entity.trim());
  if (!configuredEntities.length) throw new Error("Docker Status Badge requires at least one metric entity.");
  const normalized = { ...DOCKER_STATUS_DEFAULTS, ...config };
  for (const metric of METRICS) {
    if (typeof normalized[metric.entity] === "string") normalized[metric.entity] = normalized[metric.entity].trim();
  }
  return normalized;
}

export function parseCount(state) {
  if (!state) return { available: false, value: null, text: "—" };
  const raw = String(state.state ?? "").trim();
  if (!raw || raw.toLowerCase() === "unknown" || raw.toLowerCase() === "unavailable") return { available: false, value: null, text: "—" };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return { available: false, value: null, text: "—" };
  return { available: true, value, text: Number.isInteger(value) ? String(value) : String(value) };
}

export function dockerStatusPresentation(config, states = {}) {
  const metrics = Object.fromEntries(METRICS.map((definition) => {
    const entityId = config[definition.entity];
    const configured = typeof entityId === "string" && Boolean(entityId);
    const parsed = parseCount(configured ? states[entityId] : undefined);
    const enabled = configured && config[definition.show] !== false;
    const hiddenZero = Boolean(definition.showZero && parsed.available && parsed.value === 0 && config[definition.showZero] === false);
    const visible = enabled && (!hiddenZero || !parsed.available);
    const color = resolveColor(!parsed.available ? config.unavailable_color : parsed.value === 0 ? config.zero_color : config[definition.color]);
    return [definition.key, { ...definition, entityId, configured, enabled, hiddenZero, visible, color, ...parsed }];
  }));

  const healthy = Boolean(
    config.show_healthy_indicator
      && metrics.updates.configured && metrics.errors.configured
      && metrics.updates.enabled && metrics.errors.enabled
      && metrics.updates.available && metrics.errors.available
      && metrics.updates.value === 0 && metrics.errors.value === 0
      && metrics.updates.hiddenZero && metrics.errors.hiddenZero,
  );
  return { metrics, healthy };
}

export function defaultActionEntity(config) {
  return METRICS.map((metric) => config[metric.entity]).find(Boolean);
}
