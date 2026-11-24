# Multi Metric Graph Card

`custom:multi-metric-graph-card` displays multiple numeric entity values and Home Assistant Recorder history graphs side by side inside one card. Each metric can have its own label, unit, icon, colour, bounds, precision, and history duration.

It has no runtime dependencies and replaces combinations of grid, sensor, and card-mod cards.

## Speed test example

```yaml
type: custom:multi-metric-graph-card
columns: 3
hours_to_show: 24
refresh_interval: 60
show_icons: true
card_height: 220
metrics:
  - entity: sensor.speedtest_download
    name: Download
    icon: mdi:download
    unit: Mbps
    decimals: 1
    min: 10
    max: 70
    color: "#65b7e8"
  - entity: sensor.speedtest_upload
    name: Upload
    icon: mdi:upload
    unit: Mbps
    decimals: 1
    min: 5
    max: 30
    color: "#b09be9"
  - entity: sensor.speedtest_ping
    name: Ping
    icon: mdi:timer-outline
    unit: ms
    decimals: 0
    min: 2
    max: 50
    color: "#ff9f43"
```

The card uses the entity friendly name, unit, and icon when their overrides are omitted. Icons are hidden by default. Set `show_icons: true` globally or `show_icon: true` on an individual metric. Each label and optional icon is left-aligned while the current entity value remains centred in its metric column.

## Card options

| Option | Default | Description |
| --- | --- | --- |
| `title` | none | Optional card title. |
| `show_title` | `false` | Display the configured title. |
| `columns` | `3` | Number of graph columns, from 1 to 12. The card stacks them below 420 px. |
| `graph_height` | `120` | Graph-area height in pixels when `card_height` is not set, clamped to 16–300. |
| `card_height` | automatic | Optional total card height in pixels, clamped to 60–1000. Graphs expand to use the remaining height. Heights below 120 use compact labels, values, icons, and spacing. |
| `hours_to_show` | `24` | Default Recorder history window in hours, from 0.25 to 720. |
| `refresh_interval` | `60` | History refresh interval in seconds, clamped to 10–3600. |
| `show_icons` | `false` | Default icon visibility. |
| `show_graphs` | `true` | Default graph visibility. |
| `graph_opacity` | `0.8` | Default line opacity, from 0 to 1. |
| `graph_fill_opacity` | `0.14` | Default area-fill opacity, from 0 to 1. |
| `metrics` | required | Non-empty list of metric definitions. |

## Metric options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Entity ID with a numeric state. |
| `name` | entity friendly name | Label shown above the current value. |
| `icon` | entity icon | Material Design icon override. |
| `show_icon` | card `show_icons` | Per-metric icon visibility. |
| `unit` | entity unit | Unit appended to the current number. |
| `decimals` | `0` | Number of decimal places, from 0 to 6. |
| `color` | theme primary colour | Value, icon, line, and fill colour. |
| `color_thresholds` | `[]` | Value-based colours, ordered by threshold. |
| `min` | automatic | Fixed graph minimum. |
| `max` | automatic | Fixed graph maximum. |
| `hours_to_show` | card value | Per-metric history duration. |
| `show_graph` | card `show_graphs` | Per-metric graph visibility. |
| `graph_opacity` | card value | Per-metric line opacity. |
| `graph_fill_opacity` | card value | Per-metric fill opacity. |

Example threshold configuration:

```yaml
color: green
color_thresholds:
  - value: 70
    color: orange
  - value: 90
    color: red
```

## History and interaction

- History is loaded through Home Assistant's authenticated Recorder WebSocket API.
- Metrics with the same history duration are requested together.
- Current values update immediately without requesting history on every Home Assistant update.
- Invalid or unavailable history readings create graph gaps rather than fabricated values.
- Missing Recorder history leaves the current value visible and the graph empty.
- Click a metric, or focus it and press Enter or Space, to open its more-info dialog.

## Visual editor

The visual editor supports title settings, columns, graph height, history duration, default icon visibility, and adding or removing metric entities. Advanced per-metric options remain available in YAML.
