# Home Assistant Custom

A single HACS Dashboard repository for independently configurable Home Assistant custom cards. All cards ship in the shared, self-contained `home-assistant-custom.js` bundle with no external runtime or CDN dependencies.

> **v0.x is prerelease software.** Verify cards against your Home Assistant version and configuration before relying on them.

## Card catalogue

| Card | Type | Description | Documentation |
| --- | --- | --- | --- |
| Compact System Status Card | `custom:compact-system-status-card` | Compact numeric metrics with real Recorder sparklines and supplementary states. | [Configuration](docs/compact-system-status-card.md) |
| Multi Metric Graph Card | `custom:multi-metric-graph-card` | Multiple configurable Recorder graphs, values, units, labels, and icons in one card. | [Configuration](docs/multi-metric-graph-card.md) |
| Media Download Card | `custom:media-download-card` | Radarr/Sonarr queue artwork joined to qBittorrent progress and status. | [Configuration](docs/media-download-card.md) |

## Install with HACS

1. Open HACS in Home Assistant.
2. Open the menu and choose **Custom repositories**.
3. Add `https://github.com/maael/home-assistant-custom` with category **Dashboard**.
4. Find **Home Assistant Custom** and download it. For prereleases, select the desired version from the version/redownload menu if needed.
5. Reload the browser frontend. HACS should register `/hacsfiles/home-assistant-custom/home-assistant-custom.js` as a JavaScript module.

Both cards are installed and updated together. Do not add a separate resource or HACS repository for an individual card.

## Compact System Status Card quick start

```yaml
type: custom:compact-system-status-card
metrics:
  - entity: sensor.server_cpu_usage
    name: CPU
    unit: "%"
    min: 0
    max: 100
  - entity: sensor.server_memory_usage
    name: RAM
    unit: "%"
    min: 0
    max: 100
details:
  - entity: sensor.server_ip_address
    icon: mdi:network
    show_icon: true
  - entity: sensor.server_status
    icon: mdi:circle
    show_icon: true
    state_colors:
      online: green
      offline: red
```

See [the full card documentation](docs/compact-system-status-card.md), including the exact NAS example, all options, history behavior, and responsive layouts.

## Multi Metric Graph Card quick start

```yaml
type: custom:multi-metric-graph-card
columns: 3
card_height: 220
show_icons: true
metrics:
  - entity: sensor.speedtest_download
    name: Download
    icon: mdi:download
    unit: Mbps
    min: 10
    max: 70
  - entity: sensor.speedtest_upload
    name: Upload
    icon: mdi:upload
    unit: Mbps
    min: 5
    max: 30
  - entity: sensor.speedtest_ping
    name: Ping
    icon: mdi:timer-outline
    unit: ms
    min: 2
    max: 50
```

See [the full card documentation](docs/multi-metric-graph-card.md) for graph sizing, history, precision, colours, thresholds, and per-metric overrides.

## Media Download Card quick start

Current Home Assistant Core actions require instance identifiers:

```yaml
type: custom:media-download-card
radarr:
  entry_id: YOUR_RADARR_CONFIG_ENTRY_ID
sonarr:
  entry_id: YOUR_SONARR_CONFIG_ENTRY_ID
qbittorrent:
  download_speed_entity: sensor.qbittorrent_download_speed
  service_data:
    device_id: YOUR_QBITTORRENT_DEVICE_ID
    torrent_filter: all
```

See [Media Download Card documentation](docs/media-download-card.md) for all options and compatibility notes.

## Manual bundle installation

1. Run `npm ci && npm run build`, or download `home-assistant-custom.js` from a release.
2. Copy it to `<config>/www/home-assistant-custom.js`.
3. Add `/local/home-assistant-custom.js?v=0.3.5` under **Settings → Dashboards → Resources** as a **JavaScript module**.
4. Hard-refresh the browser.

This installs the same shared bundle used by HACS.

## Development

Requires Node.js 22.

```bash
npm ci
npm test
npm run build
npm run preview
```

The reproducible bundle is written to `dist/home-assistant-custom.js`. The deterministic browser preview is available at `http://localhost:4173/dev/preview.html` and uses mock Home Assistant states/history while rendering the actual card element.

Add cards as modules under `src/cards/`, import them from `src/index.js`, and add tests and documentation. Existing cards remain independently configurable even though they share one distribution.

Licensed under the [MIT License](LICENSE).
