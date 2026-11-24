# Home Assistant Custom

A single HACS Dashboard repository for independently configurable Home Assistant custom cards. The bundle currently includes **Media Download Card**, with queue artwork, progress, status, counts, and qBittorrent download speed.

> **v0.1.x is prerelease software.** The action names and response keys were verified against Home Assistant Core's development source, but have not been validated against the maintainer's live Home Assistant instance.

## Install with HACS

The GitHub repository must be public (or otherwise accessible to HACS) before other installations can use it.

1. Open HACS in Home Assistant.
2. Open the menu and choose **Custom repositories**.
3. Add `https://github.com/maael/home-assistant-custom` with category **Dashboard**.
4. Find **Home Assistant Custom** and download it. If HACS does not offer the prerelease automatically, use the repository's version/redownload menu to select `v0.1.0`, or install from the default branch while testing.
5. Restart or reload the browser frontend. HACS should register `/hacsfiles/home-assistant-custom/home-assistant-custom.js` as a JavaScript module.

See [Media Download Card documentation](docs/media-download-card.md) for configuration, manual installation, troubleshooting, updates, and rollback.

## Minimal usable card configuration

The current core actions require instance identifiers:

```yaml
type: custom:media-download-card
radarr:
  entry_id: YOUR_RADARR_CONFIG_ENTRY_ID
sonarr:
  entry_id: YOUR_SONARR_CONFIG_ENTRY_ID
qbittorrent:
  # Optional if the card can auto-detect this sensor:
  download_speed_entity: sensor.qbittorrent_download_speed
  service_data:
    device_id: YOUR_QBITTORRENT_DEVICE_ID
    torrent_filter: all
```

## Development

Requires Node.js 22.

```bash
npm ci
npm test
npm run build
```

The reproducible bundle is written to `dist/home-assistant-custom.js`. It has no external runtime or CDN dependencies. Add future cards as modules under `src/cards/`, import them from `src/index.js`, and add tests and documentation.

## Status

- HACS Dashboard packaging follows the current requirement that a repository-named JavaScript file exists in `dist/` or a release.
- Home Assistant's current custom-card API, module resource registration, and `window.customCards` picker registration are used.
- Current Home Assistant Core source confirms `radarr.get_queue`, `sonarr.get_queue`, and `qbittorrent.get_torrents`, their response keys, and required identifiers. Installed-version and live-instance behavior still require validation.

Licensed under the [MIT License](LICENSE).
