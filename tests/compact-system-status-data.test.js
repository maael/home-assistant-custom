import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCurrentPoint, colorForValue, detailPresentation, downsamplePoints, formatMetricValue,
  graphBounds, historyRequest, mergeSystemStatusConfig, parseHistoryStates, sparklineGeometry,
} from "../src/cards/compact-system-status-data.js";

test("validates and applies compact system status defaults", () => {
  const config = mergeSystemStatusConfig({ metrics: [{ entity: "sensor.cpu" }] });
  assert.equal(config.layout, "two-row");
  assert.equal(config.hours_to_show, 6);
  assert.equal(config.refresh_interval, 60);
  assert.equal(config.metrics[0].decimals, 0);
  assert.deepEqual(config.details, []);
  assert.throws(() => mergeSystemStatusConfig({ metrics: [] }), /non-empty/);
  assert.throws(() => mergeSystemStatusConfig({ metrics: [{ entity: "bad" }] }), /entity ID/);
  assert.throws(() => mergeSystemStatusConfig({ layout: "grid", metrics: [{ entity: "sensor.cpu" }] }), /layout/);
  assert.throws(() => mergeSystemStatusConfig({ metrics: [{ entity: "sensor.cpu", min: 10, max: 5 }] }), /less than/);
});

test("formats current values with metadata fallbacks and invalid states", () => {
  const hass = { locale: { language: "en" } };
  assert.deepEqual(formatMetricValue(hass, { state: "12.34", attributes: { unit_of_measurement: "%" } }, { decimals: 1 }), { text: "12.3%", full: "12.3%", value: 12.34, unit: "%" });
  assert.equal(formatMetricValue(hass, { state: "unavailable", attributes: {} }, { decimals: 0 }).value, null);
  assert.equal(formatMetricValue(hass, undefined, { decimals: 0 }).text, "Unavailable");
});

test("parses compact and legacy history without bridging invalid readings", () => {
  const start = Date.parse("2026-01-01T00:00:00Z");
  const end = start + 3600000;
  const points = parseHistoryStates([
    { s: "10", lu: start / 1000 },
    { s: "unknown", lu: (start + 1000) / 1000 },
    { state: "30", last_updated: new Date(start + 2000).toISOString() },
    { s: "bad", lu: (start + 3000) / 1000 },
  ], start, end);
  assert.deepEqual(points.map(({ value, breakBefore }) => ({ value, breakBefore })), [
    { value: 10, breakBefore: false }, { value: 30, breakBefore: true },
  ]);
  assert.equal(appendCurrentPoint(points, { state: "40" }, start + 4000).at(-1).value, 40);
  assert.deepEqual(parseHistoryStates(undefined, start, end), []);
});

test("downsampling retains peaks and graph scaling uses timestamps", () => {
  const points = Array.from({ length: 200 }, (_, index) => ({ time: index * 1000, value: index === 101 ? 999 : Math.sin(index), breakBefore: false }));
  const sampled = downsamplePoints(points, 40);
  assert.ok(sampled.length <= 40);
  assert.ok(sampled.some((point) => point.value === 999));
  const bounds = graphBounds(sampled, 0, 1000);
  assert.deepEqual(bounds, { min: 0, max: 1000 });
  const geometry = sparklineGeometry([{ time: 0, value: 0 }, { time: 500, value: 50 }, { time: 1000, value: 100 }], { startMs: 0, endMs: 1000, min: 0, max: 100, width: 100, height: 46 });
  assert.match(geometry.paths[0], /M0.00,46.00 L50.00,23.00 L100.00,0.00/);
});

test("maps thresholds, status colours and labels case-insensitively", () => {
  assert.equal(colorForValue(75, "blue", [{ value: 50, color: "orange" }, { value: 90, color: "red" }]), "orange");
  assert.deepEqual(detailPresentation({ state: "Online" }, { state_colors: { online: "green" }, state_labels: { online: "Ready" } }), { raw: "Online", label: "Ready", color: "green" });
});

test("builds the supported batched history WebSocket request", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-01T06:00:00Z");
  assert.deepEqual(historyRequest(start, end, ["sensor.cpu", "sensor.ram"]), {
    type: "history/history_during_period", start_time: start.toISOString(), end_time: end.toISOString(), entity_ids: ["sensor.cpu", "sensor.ram"], minimal_response: true, no_attributes: true,
  });
});
