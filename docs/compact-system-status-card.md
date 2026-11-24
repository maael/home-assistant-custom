# Compact System Status Card

`custom:compact-system-status-card` combines current numeric readings, real Home Assistant Recorder history, and supplementary entity states in one compact card. It has no runtime dependencies and does not require Mushroom, card-mod, mini-graph-card, or stack-in-card.

## Install

Install **Home Assistant Custom** from this repository through HACS as a Dashboard custom repository. The card is included in the same `home-assistant-custom.js` bundle as Media Download Card; do not add a separate resource for it. See the repository [README](../README.md) for HACS and manual bundle installation.

## NAS example

```yaml
type: custom:compact-system-status-card
title: Lovelace
show_title: false
layout: two-row
hours_to_show: 6
refresh_interval: 60
metrics:
  - entity: sensor.ugreen_nas_cpu_usage
    name: CPU
    icon: mdi:cpu-64-bit
    unit: "%"
    color: "#65b7e8"
    min: 0
    max: 100
  - entity: sensor.ugreen_nas_ram_usage
    name: RAM
    icon: mdi:memory
    unit: "%"
    color: "#b09be9"
    min: 0
    max: 100
details:
  - entity: sensor.lovelace_lan1_ip
    icon: mdi:network
  - entity: sensor.ugreen_nas_server_status
    icon: mdi:circle
    state_colors:
      online: green
      offline: red
      unavailable: grey
```

Icons are hidden by default. To display the icons in this example, add `show_icons: true`, set `show_icon: true` on individual entries, or both. `mdi:circle` is rendered as a compact status dot.

## Card options

| Option | Default | Description |
| --- | --- | --- |
| `title` | none | Optional title text. |
| `show_title` | `false` | Display `title` above the card content. |
| `layout` | `two-row` | `two-row` places metrics above details. `single-row` places both horizontally and falls back to two rows below 600 px card width. |
| `hours_to_show` | `6` | Default Recorder history window in hours, from 0.25 to 720. |
| `refresh_interval` | `60` | History refresh interval in seconds, clamped to 10–3600. Current states update whenever Home Assistant updates `hass`. |
| `show_icons` | `false` | Default icon visibility for metrics and details. |
| `show_graphs` | `true` | Default sparkline visibility. |
| `graph_opacity` | `0.35` | Default line opacity, 0–1. |
| `graph_fill_opacity` | `0.12` | Default area-fill opacity, 0–1. |
| `metrics` | required | Non-empty array of numeric metric definitions. |
| `details` | `[]` | Supplementary entity definitions. |

## Metric options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Entity ID containing a numeric state. |
| `name` | entity friendly name | Compact metric label. |
| `icon` | entity icon | Material Design icon. |
| `show_icon` | card `show_icons` | Per-metric icon visibility. |
| `unit` | entity unit | Unit override. `%` and temperature units are attached without an extra space. |
| `decimals` | `0` | Decimal places, 0–6. |
| `color` | theme primary colour | Graph, value, and icon colour. |
| `color_thresholds` | `[]` | Ordered threshold list such as `[{ value: 70, color: orange }, { value: 90, color: red }]`. The highest threshold not exceeding the current value wins. |
| `min` | automatic | Fixed graph minimum. |
| `max` | automatic | Fixed graph maximum. |
| `hours_to_show` | card value | Per-metric history window. Metrics with the same window are fetched together. |
| `show_graph` | card `show_graphs` | Per-metric sparkline visibility. |
| `graph_opacity` | card value | Per-metric line opacity. |
| `graph_fill_opacity` | card value | Per-metric fill opacity. |

## Supplementary detail options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Entity whose current state should be displayed. |
| `name` | entity friendly name | Display-name override. |
| `show_name` | `false` | Prefix the state with the name. |
| `icon` | entity icon | Material Design icon. Use `mdi:circle` or `dot` for a compact status dot. |
| `color` | secondary text colour | Default icon/dot colour. |
| `state_colors` | `{}` | Case-insensitive state-to-colour map. Example: `{ online: green, offline: red }`. |
| `state_labels` | `{}` | Case-insensitive state-to-label map. Example: `{ online: Online, unavailable: Unknown }`. |
| `show_icon` | card `show_icons` | Per-detail icon visibility. |

An `unavailable` detail is shown as unavailable unless explicitly relabelled. The card never assumes this means that the monitored device is offline.

## More examples

### Single row with responsive fallback

```yaml
type: custom:compact-system-status-card
layout: single-row
show_icons: true
metrics:
  - entity: sensor.server_cpu
    name: CPU
    min: 0
    max: 100
  - entity: sensor.server_temperature
    name: Temp
    decimals: 1
details:
  - entity: binary_sensor.server_online
    name: Server
    show_name: true
    icon: mdi:circle
    state_labels:
      "on": Online
      "off": Offline
    state_colors:
      "on": green
      "off": red
```

### Disk threshold colours and missing history

```yaml
type: custom:compact-system-status-card
metrics:
  - entity: sensor.nas_disk_usage
    name: Disk
    unit: "%"
    min: 0
    max: 100
    color: "#65b7e8"
    color_thresholds:
      - value: 70
        color: orange
      - value: 90
        color: red
  - entity: sensor.nas_temperature
    name: Temp
    decimals: 1
```

If Recorder excludes an entity or returns no history, its current value still appears and the graph remains empty.

## History and updates

- History uses Home Assistant's authenticated `history/history_during_period` WebSocket command with `minimal_response` and `no_attributes`, matching the current Home Assistant frontend implementation.
- Requests are batched by history duration and are not made on every `hass` assignment.
- Current values update immediately from Home Assistant state objects.
- History is retained in card memory, refreshed on the configured interval, and downsampled to at most 80 points per graph while retaining bucket minima and maxima.
- Graph X positions use actual timestamps. Invalid, unknown, and unavailable history readings are omitted and create a break instead of a fabricated bridge.
- The current valid state is appended at the current timestamp. No fake history is generated.
- Automatic bounds include a small padding; configured `min` and `max` take precedence.
- Empty history, Recorder exclusions, disconnected WebSockets, and request failures leave the card usable with current states.
- Timers and stale request generations are cleaned up when the card disconnects.

## Interaction and accessibility

Metrics and details are keyboard-focusable buttons. Click them, or press Enter/Space, to open Home Assistant's more-info dialog. Accessible labels include entity names and full current values. Hover titles include metric values and history duration.

## Visual editor

The dashboard card editor supports title, title visibility, layout, history duration, icon visibility, and adding/removing metric and detail entities with Home Assistant entity pickers. Advanced options remain available through YAML.

## Development preview

The deterministic preview renders the real custom element with mock Home Assistant states and history:

```bash
npm run preview
# open http://localhost:4173/dev/preview.html
```

It includes two-row and single-row layouts, title/no-title examples, disk and temperature metrics, unavailable and missing-history states, light/dark themes, and a narrow mobile width. This preview is mock-based and does not verify a live Home Assistant Recorder instance.

## Troubleshooting

- **No graph:** confirm Recorder includes the entity and wait for the initial history request. Current values work without Recorder history.
- **Custom element does not exist:** update the HACS repository, reload resources, and hard-refresh the browser.
- **Wrong unit/name/icon:** set the relevant override or correct the entity metadata.
- **Single row wraps:** this is intentional below 600 px card width to keep values readable.
- **History API errors:** inspect the browser console and verify the logged-in user can access history. The card never makes external network requests.
