# Docker Status Badge

`custom:docker-status-badge` displays Docker container totals, available updates, errors, and optionally up-to-date containers in one compact Home Assistant dashboard badge. It reads existing Home Assistant entities only: it does not connect to Docker or What's Up Docker (WUD), store credentials, or poll an external API.

The badge uses the native `ha-badge` container and is sized to sit naturally beside Mushroom template badges and other dashboard badges.

## Minimal configuration

Add the badge to a dashboard view's **Badges** section:

```yaml
type: custom:docker-status-badge
total_entity: sensor.wud_containers
updates_entity: sensor.wud_updates_available
errors_entity: sensor.wud_errors
```

Every entity ID is configurable. Any metric may be omitted, but at least one metric entity must be configured.

## Full example

```yaml
type: custom:docker-status-badge

total_entity: sensor.wud_containers
updates_entity: sensor.wud_updates_available
errors_entity: sensor.wud_errors
up_to_date_entity: sensor.wud_up_to_date

icon: mdi:docker
icon_color: "#2496ed"

total_color: primary
updates_icon: mdi:package-up
updates_color: orange
errors_icon: mdi:alert-circle-outline
errors_color: red
up_to_date_icon: mdi:check-circle-outline
up_to_date_color: green

zero_color: green
unavailable_color: grey

show_icon: true
show_total: true
show_updates: true
show_errors: true
show_up_to_date: false

show_zero_updates: true
show_zero_errors: true
show_zero_up_to_date: true

show_separator: true
show_healthy_indicator: true
healthy_icon: mdi:check-circle-outline
healthy_color: green

tap_action:
  action: url
  url_path: http://192.168.4.204:3006

hold_action:
  action: more-info
  entity: sensor.wud_updates_available
```

## Configuration reference

### Entities

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `total_entity` | string | unset | Entity containing the total monitored-container count. |
| `updates_entity` | string | unset | Entity containing the available-update count. |
| `errors_entity` | string | unset | Entity containing the checking-error count. |
| `up_to_date_entity` | string | unset | Optional entity containing the up-to-date count. |

At least one of these options is required. Missing, `unknown`, `unavailable`, negative, or non-numeric states are shown as an em dash and are never interpreted as zero.

### Icons and colours

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `icon` | string | `mdi:docker` | Primary badge icon. |
| `icon_color` | colour | `#2496ed` | Primary icon colour. |
| `total_color` | colour | `primary` | Positive total count colour. |
| `updates_icon` | string | `mdi:package-up` | Updates icon. |
| `updates_color` | colour | `orange` | Positive update count colour. |
| `errors_icon` | string | `mdi:alert-circle-outline` | Errors icon. |
| `errors_color` | colour | `red` | Positive error count colour. |
| `up_to_date_icon` | string | `mdi:check-circle-outline` | Up-to-date icon. |
| `up_to_date_color` | colour | `green` | Up-to-date count colour. |
| `zero_color` | colour | `green` | Colour for visible zero counts. |
| `unavailable_color` | colour | `grey` | Colour for unavailable or invalid metrics. |
| `healthy_icon` | string | `mdi:check-circle-outline` | Icon used by the healthy indicator. |
| `healthy_color` | colour | `green` | Healthy indicator colour. |

Colours accept Home Assistant semantic names such as `primary`, `accent`, `success`, `warning`, and `error`; common named colours; theme variables such as `var(--primary-color)`; and CSS colours such as `#2496ed`, `rgb(...)`, or `hsl(...)`. Common status colour names use Home Assistant theme variables where available.

### Visibility

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `show_icon` | boolean | `true` | Show the primary Docker icon. |
| `show_total` | boolean | `true` | Show the total metric when configured. |
| `show_updates` | boolean | `true` | Show the updates metric when configured. |
| `show_errors` | boolean | `true` | Show the errors metric when configured. |
| `show_up_to_date` | boolean | `false` | Show the optional up-to-date metric. |
| `show_zero_updates` | boolean | `true` | Keep a valid zero update count visible. |
| `show_zero_errors` | boolean | `true` | Keep a valid zero error count visible. |
| `show_zero_up_to_date` | boolean | `true` | Keep a valid zero up-to-date count visible. |
| `show_separator` | boolean | `true` | Show a subtle separator when content exists on both sides. |
| `show_healthy_indicator` | boolean | `true` | Show the healthy icon when updates and errors are both valid zero values and both are hidden by their `show_zero_*` settings. |

An unavailable metric remains visible as an em dash even when its `show_zero_*` option is false. This prevents missing monitoring data from looking healthy.

### Actions

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `tap_action` | action | `{ action: more-info }` | Action performed when the badge is tapped or keyboard-activated. |
| `hold_action` | action | `{ action: none }` | Action performed after holding the badge. |
| `double_tap_action` | action | `{ action: none }` | Action performed on double tap/click. |

Supported action values are:

- `more-info`, with an optional `entity`. Without one, the first configured metric entity is used.
- `url`, with `url_path`.
- `navigate`, with `navigation_path`.
- `perform-action`, with `perform_action`, plus optional `data` and `target` YAML.
- `none`.

`call-service` with `service` remains accepted as an alias for `perform-action`.

## Common configurations

### Hide zero counts and show one healthy icon

```yaml
type: custom:docker-status-badge
total_entity: sensor.wud_containers
updates_entity: sensor.wud_updates_available
errors_entity: sensor.wud_errors
show_zero_updates: false
show_zero_errors: false
show_healthy_indicator: true
tap_action:
  action: url
  url_path: http://192.168.4.204:3006
```

### Updates and errors only

```yaml
type: custom:docker-status-badge
updates_entity: sensor.wud_updates_available
errors_entity: sensor.wud_errors
show_total: false
```

### Full monitoring badge

```yaml
type: custom:docker-status-badge
total_entity: sensor.wud_containers
updates_entity: sensor.wud_updates_available
errors_entity: sensor.wud_errors
up_to_date_entity: sensor.wud_up_to_date
show_up_to_date: true
```

## State examples

The actual badge uses MDI icons; the descriptions below show the content order.

| State | Example appearance | Behaviour |
| --- | --- | --- |
| Healthy, zeros visible | Docker `42` · package-up `0` · alert `0` | Zero metrics use `zero_color`. |
| Healthy, zeros hidden | Docker `42` · check-circle | The healthy indicator replaces both hidden zero metrics. |
| Updates available | Docker `42` · package-up `5` · alert `0` | Updates use `updates_color`; the visible zero uses `zero_color`. |
| Errors present | Docker `42` · package-up `0` · alert `2` | Errors use `errors_color`. |
| Unavailable data | Docker `42` · package-up `—` · alert `—` | Invalid metrics remain visible in `unavailable_color`; no healthy state is implied. |

The badge updates whenever Home Assistant supplies new entity states. It uses tabular numerals and removes separators and spacing when adjacent content is hidden.

## Data sources: WUD, UGREEN Docker, or others

WUD can expose counts through REST endpoints, and Home Assistant REST sensors can turn those responses into entities such as `sensor.wud_containers`, `sensor.wud_updates_available`, `sensor.wud_errors`, and `sensor.wud_up_to_date`. Configure and verify those sensors separately, then reference their entity IDs in this badge.

For native UGREEN OS Docker counts, install [UGREEN Docker](https://github.com/maael/home-assistant-custom-integration) through HACS as an **Integration** and select its container total, container update, and container error sensors in this badge. Keep its project-update sensor separate because project and container scopes can overlap.

The badge does not require a particular WUD URL, UGREEN NAS, or sensor implementation. Existing template, REST, MQTT, or other numeric Home Assistant entities work equally well.

## Visual editor

The Home Assistant badge editor provides grouped controls for entities, icons, colours, visibility, zero handling, the healthy indicator, and tap/hold/double-tap actions. YAML remains available for advanced action `data` and `target` objects.
