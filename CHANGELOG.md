# Changelog

## [0.1.3] - 2026-04-13

### Added

- Overall `max_items` display limit, defaulting to eight with `0` for unlimited.
- Descending per-torrent download-speed ordering when the action response provides speed fields.

### Changed

- Movie ETA/status now sits directly below the poster without an empty TV episode line.

## [0.1.2] - 2026-04-13

### Added

- Home Assistant icons for movie, TV show, and torrent counts in the compact summary row.
- Explicit `title: false` support for a summary-only header, while retaining custom string titles.

## [0.1.1] - 2026-04-13

### Added

- Compact one-line header statistics for queued movies, TV shows, torrents, and qBittorrent download speed.
- Automatic qBittorrent download-speed sensor detection with a `download_speed_entity` override.
- Fallback aggregation when torrent responses provide numeric speed fields.

## [0.1.0] - 2026-04-13

### Added

- Initial prerelease of the bundled HACS Dashboard repository.
- Read-only Media Download Card with Radarr/Sonarr hash matching to qBittorrent.
- Responsive poster grid, progress/status display, polling, partial-failure handling, and configuration options.
- Synthetic fixtures, transformation and mocked-browser tests, CI, release automation, and installation documentation.

[0.1.3]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.3
[0.1.2]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.2
[0.1.1]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.1
[0.1.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.0
