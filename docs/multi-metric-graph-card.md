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

The card uses the entity friendly name, unit, and icon when their overrides are omitted. Icons are hidden by default. Set `show_icons: true` globally or `show_icon: true` on an individual metric. The optional icon and metric name are overlaid at the top-left of the graph while the current entity value is overlaid at the top-right.

Metrics remain in the configured number of columns even when the dashboard gives the card a narrow container. Set `stack_on_narrow: true` only when vertical stacking below 420px is desired.

## Card options

| Option | Default | Description |
| --- | --- | --- |
| `title` | none | Optional card title. |
| `show_title` | `false` | Display the configured title. |
| `columns` | `3` | Number of graph columns, from 1 to 12. Columns remain horizontal regardless of card width by default. |
| `stack_on_narrow` | `false` | Stack metrics vertically when the card is narrower than 420px. |
| `graph_height` | `120` | Graph-area height in pixels when `card_height` is not set, clamped to 16–300. |
| `card_height` | automatic | Optional total card height in pixels, clamped to 60–1000. Graphs expand to use the remaining height. Heights below 120 use compact labels, values, icons, and spacing. |
| `hours_to_show` | `24` | Default Recorder history window in hours, from 0.25 to 720. |
| `refresh_interval` | `60` | History refresh interval in seconds, clamped to 10–3600. |
| `show_icons` | `false` | Default icon visibility. |
| `show_names` | `true` | Default metric-name visibility. |
| `show_graphs` | `true` | Default graph visibility. |
| `graph_opacity` | `0.8` | Default line opacity, from 0 to 1. |
| `graph_fill_opacity` | `0.14` | Default area-fill opacity, from 0 to 1. |
| `value_position` | `right` | Current-value position: `right` or `center`. Center places it in the horizontal and vertical middle of the graph. |
| `value_size` | theme default | Current-value font size in pixels, from 8 to 96. |
| `metrics` | required | Non-empty list of metric definitions. |

## Metric options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Entity ID with a numeric state. |
| `name` | entity friendly name | Label shown above the current value. |
| `icon` | entity icon | Material Design icon override. |
| `show_icon` | card `show_icons` | Per-metric icon visibility. |
| `show_name` | card `show_names` | Per-metric name visibility. The icon can remain visible when the name is hidden. |
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
| `value_position` | card value | Per-metric `right` or `center` value position. |
| `value_size` | card value | Per-metric value font size in pixels. |

Example with a large value centred in the graph:

```yaml
value_position: center
value_size: 36
```

Both options can also be set on an individual metric.

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
