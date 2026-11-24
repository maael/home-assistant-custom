import test from "node:test";
import assert from "node:assert/strict";
import { mergeMultiMetricGraphConfig } from "../src/cards/multi-metric-graph-data.js";

test("validates and applies multi metric graph defaults", () => {
  const config = mergeMultiMetricGraphConfig({ metrics: [{ entity: "sensor.download" }] });
  assert.equal(config.columns, 3);
  assert.equal(config.graph_height, 120);
  assert.equal(config.hours_to_show, 24);
  assert.equal(config.refresh_interval, 60);
  assert.equal(config.show_icons, false);
  assert.equal(config.metrics[0].decimals, 0);
  assert.throws(() => mergeMultiMetricGraphConfig({ metrics: [] }), /non-empty/);
  assert.throws(() => mergeMultiMetricGraphConfig({ metrics: [{ entity: "bad" }] }), /entity ID/);
  assert.throws(() => mergeMultiMetricGraphConfig({ metrics: [{ entity: "sensor.bad", min: 10, max: 5 }] }), /less than/);
});

test("normalizes card and per-metric graph options", () => {
  const config = mergeMultiMetricGraphConfig({
    columns: 99, graph_height: 20, graph_opacity: 2, graph_fill_opacity: -1,
    metrics: [{
      entity: "sensor.download", decimals: 9, hours_to_show: 6, show_icon: true,
      show_graph: false, min: "10", max: "70",
      color_thresholds: [{ value: 50, color: "orange" }, { value: 20, color: "green" }],
    }],
  });
  assert.equal(config.columns, 12);
  assert.equal(config.graph_height, 60);
  assert.equal(config.graph_opacity, 1);
  assert.equal(config.graph_fill_opacity, 0);
  assert.equal(config.metrics[0].decimals, 6);
  assert.equal(config.metrics[0].show_icon, true);
  assert.equal(config.metrics[0].show_graph, false);
  assert.deepEqual(config.metrics[0].color_thresholds.map((entry) => entry.value), [20, 50]);
});
