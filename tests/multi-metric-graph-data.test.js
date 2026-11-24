import test from "node:test";
import assert from "node:assert/strict";
import { mergeMultiMetricGraphConfig } from "../src/cards/multi-metric-graph-data.js";

test("validates and applies multi metric graph defaults", () => {
  const config = mergeMultiMetricGraphConfig({ metrics: [{ entity: "sensor.download" }] });
  assert.equal(config.columns, 3);
  assert.equal(config.graph_height, 120);
  assert.equal(config.card_height, null);
  assert.equal(config.hours_to_show, 24);
  assert.equal(config.refresh_interval, 60);
  assert.equal(config.show_icons, false);
  assert.equal(config.show_names, true);
  assert.equal(config.value_position, "right");
  assert.equal(config.value_size, undefined);
  assert.equal(config.metrics[0].decimals, 0);
  assert.throws(() => mergeMultiMetricGraphConfig({ metrics: [] }), /non-empty/);
  assert.throws(() => mergeMultiMetricGraphConfig({ metrics: [{ entity: "bad" }] }), /entity ID/);
  assert.throws(() => mergeMultiMetricGraphConfig({ metrics: [{ entity: "sensor.bad", min: 10, max: 5 }] }), /less than/);
});

test("normalizes card and per-metric graph options", () => {
  const config = mergeMultiMetricGraphConfig({
    columns: 99, graph_height: 20, card_height: 240, graph_opacity: 2, graph_fill_opacity: -1, value_position: "center", value_size: 40,
    metrics: [{
      entity: "sensor.download", decimals: 9, hours_to_show: 6, show_icon: true, show_name: false,
      show_graph: false, value_position: "right", value_size: 30, min: "10", max: "70",
      color_thresholds: [{ value: 50, color: "orange" }, { value: 20, color: "green" }],
    }],
  });
  assert.equal(config.columns, 12);
  assert.equal(config.graph_height, 20);
  assert.equal(config.card_height, 240);
  assert.equal(config.graph_opacity, 1);
  assert.equal(config.graph_fill_opacity, 0);
  assert.equal(config.value_position, "center");
  assert.equal(config.value_size, 40);
  assert.equal(config.metrics[0].decimals, 6);
  assert.equal(config.metrics[0].show_icon, true);
  assert.equal(config.metrics[0].show_name, false);
  assert.equal(config.metrics[0].show_graph, false);
  assert.equal(config.metrics[0].value_position, "right");
  assert.equal(config.metrics[0].value_size, 30);
  assert.deepEqual(config.metrics[0].color_thresholds.map((entry) => entry.value), [20, 50]);
  assert.equal(mergeMultiMetricGraphConfig({ graph_height: 1, card_height: 30, metrics: [{ entity: "sensor.download" }] }).graph_height, 16);
  assert.equal(mergeMultiMetricGraphConfig({ graph_height: 1, card_height: 30, metrics: [{ entity: "sensor.download" }] }).card_height, 60);
  assert.throws(() => mergeMultiMetricGraphConfig({ card_height: "tall", metrics: [{ entity: "sensor.download" }] }), /card_height/);
  assert.throws(() => mergeMultiMetricGraphConfig({ value_position: "left", metrics: [{ entity: "sensor.download" }] }), /value_position/);
  assert.throws(() => mergeMultiMetricGraphConfig({ value_size: "large", metrics: [{ entity: "sensor.download" }] }), /value_size/);
});
