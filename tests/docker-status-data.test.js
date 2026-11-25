import test from "node:test";
import assert from "node:assert/strict";
import {
  dockerStatusPresentation, normalizeDockerStatusConfig, parseCount, resolveColor,
} from "../src/badges/docker-status-data.js";

const state = (value) => ({ state: value, attributes: {} });

test("validates metric entities and applies badge defaults", () => {
  assert.throws(() => normalizeDockerStatusConfig({}), /at least one metric entity/);
  const config = normalizeDockerStatusConfig({ updates_entity: " sensor.updates " });
  assert.equal(config.updates_entity, "sensor.updates");
  assert.equal(config.icon, "mdi:docker");
  assert.equal(config.show_up_to_date, false);
  assert.equal(config.show_zero_updates, true);
  assert.deepEqual(config.tap_action, { action: "more-info" });
});

test("parses positive and zero counts without treating invalid states as zero", () => {
  assert.deepEqual(parseCount(state("42")), { available: true, value: 42, text: "42" });
  assert.deepEqual(parseCount(state("0")), { available: true, value: 0, text: "0" });
  for (const value of ["unknown", "unavailable", "", "not-a-number", "-1"]) {
    assert.deepEqual(parseCount(state(value)), { available: false, value: null, text: "—" });
  }
  assert.deepEqual(parseCount(undefined), { available: false, value: null, text: "—" });
});

test("handles zero visibility, unavailable metrics and healthy state independently", () => {
  const config = normalizeDockerStatusConfig({
    total_entity: "sensor.total", updates_entity: "sensor.updates", errors_entity: "sensor.errors",
    show_zero_updates: false, show_zero_errors: false,
  });
  let presentation = dockerStatusPresentation(config, {
    "sensor.total": state("42"), "sensor.updates": state("0"), "sensor.errors": state("0"),
  });
  assert.equal(presentation.metrics.total.visible, true);
  assert.equal(presentation.metrics.updates.visible, false);
  assert.equal(presentation.metrics.errors.visible, false);
  assert.equal(presentation.healthy, true);

  presentation = dockerStatusPresentation(config, {
    "sensor.total": state("42"), "sensor.updates": state("unavailable"), "sensor.errors": state("0"),
  });
  assert.equal(presentation.metrics.updates.visible, true);
  assert.equal(presentation.metrics.updates.text, "—");
  assert.equal(presentation.healthy, false);

  presentation = dockerStatusPresentation(config, {
    "sensor.total": state("42"), "sensor.updates": state("0"), "sensor.errors": state("2"),
  });
  assert.equal(presentation.metrics.errors.visible, true);
  assert.equal(presentation.healthy, false);
});

test("uses metric, zero, unavailable, semantic and custom CSS colours", () => {
  const config = normalizeDockerStatusConfig({
    updates_entity: "sensor.updates", errors_entity: "sensor.errors", up_to_date_entity: "sensor.current",
    show_up_to_date: true, updates_color: "#f80", errors_color: "error", up_to_date_color: "var(--my-green)", zero_color: "green",
  });
  const presentation = dockerStatusPresentation(config, {
    "sensor.updates": state("3"), "sensor.errors": state("0"), "sensor.current": state("unavailable"),
  });
  assert.equal(presentation.metrics.updates.color, "#f80");
  assert.match(presentation.metrics.errors.color, /--green-color/);
  assert.match(presentation.metrics.up_to_date.color, /--grey-color/);
  assert.equal(resolveColor("var(--custom-colour)"), "var(--custom-colour)");
  assert.match(resolveColor("primary"), /--primary-color/);
});
