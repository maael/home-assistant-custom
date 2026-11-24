# Media Download Card

`custom:media-download-card` displays Radarr movie and Sonarr TV queue entries, joined to qBittorrent by normalized torrent hash. It is read-only and makes authenticated Home Assistant WebSocket action calls; it never contacts Radarr, Sonarr, or qBittorrent directly.

## Important compatibility note

The defaults `radarr.get_queue`, `sonarr.get_queue`, and `qbittorrent.get_torrents` and their `movies`, `shows`, and `torrents` responses were verified against Home Assistant Core development source at commit `e5f22d934c3d96833d0f3dd48ab44ff27779ba1f`. They have **not been confirmed on the maintainer's live installation**, and installed integration versions differ. Before reporting a card bug, open **Developer Tools → Actions**, locate each action, run it with the required parameters, and inspect its response.

The card accepts mappings or arrays, normal response envelopes, and entity-keyed responses. A missing required collection is treated as an error, not an empty queue.

## Install

### HACS custom repository

1. In HACS, add `https://github.com/maael/home-assistant-custom` as a **Dashboard** custom repository.
2. Download **Home Assistant Custom**. For prerelease versions, select the newest version from HACS's version/redownload menu if it is not offered by default.
3. Reload the browser. HACS normally registers this module automatically:

```text
/hacsfiles/home-assistant-custom/home-assistant-custom.js
```

### Manual local installation

1. Build with `npm ci && npm run build`, or download `home-assistant-custom.js` from a release.
2. Copy it to `<config>/www/home-assistant-custom.js`.
3. If `www` was newly created, restart Home Assistant.
4. Go to **Settings → Dashboards → Resources → Add resource**.
5. Add `/local/home-assistant-custom.js?v=0.1.1` as **JavaScript module**.
6. Hard-refresh the browser.

## Minimal usable YAML

Current Home Assistant Core requires Radarr and Sonarr config entry IDs plus a qBittorrent device ID. Find or select these values in **Developer Tools → Actions**.

```yaml
type: custom:media-download-card
radarr:
  entry_id: YOUR_RADARR_CONFIG_ENTRY_ID
sonarr:
  entry_id: YOUR_SONARR_CONFIG_ENTRY_ID
qbittorrent:
  service_data:
    device_id: YOUR_QBITTORRENT_DEVICE_ID
    torrent_filter: all
```

A bare `type: custom:media-download-card` loads the card, but current core actions reject its calls because those instance identifiers are required.

## Full YAML

```yaml
type: custom:media-download-card
title: Media Downloads
radarr:
  action: get_queue
  # entry_id: your_config_entry_id
  service_data: {}
sonarr:
  action: get_queue
  # entry_id: your_config_entry_id
  service_data: {}
qbittorrent:
  action: get_torrents
  download_speed_entity: sensor.qbittorrent_download_speed
  service_data:
    device_id: your_qbittorrent_device_id
    torrent_filter: all
appearance:
  columns: 4
  rows: 2
  gap: 8
  border_radius: 8
  show_title: false
  show_episode: true
  show_eta: true
  show_summary: true
  progress_colour: '#4CAF50'
  progress_bar_height: 5
  progress_text_size: 16
  progress_decimals: 1
  progress_text_background: 'rgba(0, 0, 0, 0.65)'
  grayscale_inactive: true
  inactive_opacity: 0.65
  show_pause_icon: true
behaviour:
  refresh_interval: 10
  sort_active_first: true
  hide_completed: true
  hide_inactive: false
  scrollable: true
```

## Options

### Top level

| Option | Default | Description |
| --- | --- | --- |
| `title` | `Media Downloads` | Card heading. Set to an empty string to hide it when the summary is also disabled. |
| `radarr`, `sonarr`, `qbittorrent` | See below | Per-integration action configuration. |

Each integration supports:

| Option | Default | Description |
| --- | --- | --- |
| `action` | `get_queue` / `get_torrents` | Action name within that integration domain. |
| `service_data` | `{}` | Arbitrary action parameters. |
| `entry_id` | unset | Convenience config entry ID, added to `service_data.entry_id` unless already present. Current Radarr and Sonarr actions require it. Current qBittorrent instead requires `service_data.device_id`. |
| `qbittorrent.download_speed_entity` | auto-detected | qBittorrent download-speed sensor. Set this explicitly if the card cannot uniquely detect it. |

### `appearance`

| Option | Default | Description |
| --- | --- | --- |
| `columns` | `4` | Grid columns, clamped to 1–12. |
| `rows` | `2` | Visible rows. `0` is unlimited. |
| `gap` | `8` | Grid gap in pixels. |
| `border_radius` | `8` | Poster corner radius in pixels. |
| `show_title` | `false` | Show media titles below posters. Titles remain in accessible labels. |
| `show_episode` | `true` | Show TV season/episode information. Movie entries reserve the same alignment line. |
| `show_eta` | `true` | Show ETA for active downloads and status for inactive downloads. |
| `show_summary` | `true` | Show one compact line with queued movie, TV show, and torrent counts plus total download speed and stale state. |
| `progress_colour` | `#4CAF50` | Active progress bar colour. |
| `progress_bar_height` | `5` | Progress bar height in pixels. |
| `progress_text_size` | `16` | Percentage text size in pixels. |
| `progress_decimals` | `1` | Percentage decimal places, 0–3. |
| `progress_text_background` | `rgba(0, 0, 0, 0.65)` | Percentage label background. |
| `grayscale_inactive` | `true` | Desaturate inactive artwork. |
| `inactive_opacity` | `0.65` | Inactive artwork opacity, 0.1–1. |
| `show_pause_icon` | `true` | Show a central state symbol for inactive, stalled, queued, error, and unknown items. |

### `behaviour`

| Option | Default | Description |
| --- | --- | --- |
| `refresh_interval` | `10` | Poll interval in seconds, clamped to 2–3600. Polling stops when detached and requests never overlap. |
| `sort_active_first` | `true` | Put active downloads first, then sort deterministically by title/hash. |
| `hide_completed` | `true` | Hide completed and seeding entries. |
| `hide_inactive` | `false` | Hide all non-active entries. |
| `scrollable` | `true` | Scroll vertically after the configured row count. If false, only `columns × rows` items are rendered. |

## Matching and display behavior

- Joins use torrent IDs/hashes only, after trimming and lowercasing. Titles are never used for matching.
- Duplicate Arr entries sharing a hash are combined; TV episode labels are retained and sorted.
- qBittorrent progress is interpreted as 0–100. Arr progress and then `size`/`size_left` are fallbacks.
- Unmatched Arr entries show **Unknown status**, not Paused. Unrelated qBittorrent torrents are ignored.
- Recognized download states include downloading, forcedDL, stalledDL, queuedDL, pausedDL, stoppedDL, checkingDL, metaDL, errors, and unknown values.
- The header reports total qBittorrent download speed from `qbittorrent.download_speed_entity`. The card automatically detects a unique qBittorrent data-rate sensor named “Download speed”; configure the entity explicitly if detection is ambiguous. If future torrent action responses contain numeric speed fields, their sum is used as a fallback.
- For individual torrent activity, a numeric speed field means zero is inactive and positive can be active subject to state. Current `get_torrents` responses omit per-torrent speed, so state remains a proxy and exact zero-speed detection is impossible.
- ETA supports numeric seconds and `HH:MM:SS` with hours beyond 24. Null, `None`, invalid values, and estimates over 365 days (including observed sentinel values) become **Unknown ETA**. Arr `time_left` is a fallback.
- Artwork permits only HTTP(S) URLs. Broken or absent posters get a text fallback.
- Partial action failures retain the last good source data and mark the card **Stale**.

## Troubleshooting

- **Custom element doesn't exist:** confirm the module resource loaded, check the browser console, and hard-refresh with a versioned URL.
- **Action not found:** use Developer Tools → Actions to find the installed integration's real action name, then override `action`.
- **Action needs parameters:** current Radarr/Sonarr require `entry_id`; current qBittorrent requires `service_data.device_id` and uses `torrent_filter`. Add any version-specific parameters exactly as Developer Tools requires.
- **Missing `movies`/`shows`/`torrents`:** inspect the action response. The card intentionally reports this as an error rather than pretending the queue is empty.
- **Everything is unknown:** verify the Arr `download_id` and qBittorrent `id` refer to the same torrent hash.
- **Header shows `↓ —`:** set `qbittorrent.download_speed_entity` to the entity shown under **Settings → Devices & services → qBittorrent → Entities** with the name **Download speed**.
- **Progress moves but active detection is imperfect:** current qBittorrent action responses have no per-torrent download speed; state is therefore used as a proxy.

## Updates and rollback

Use HACS's update flow, then reload the frontend. To roll back, open the HACS repository version/redownload menu and choose an earlier release. For manual installs, replace the JS file and increment the resource query string (for example `?v=0.1.2`) to bypass browser cache.
