# Changelog

## Unreleased

### Added

- Manual GitHub Actions release dispatch that validates a requested tag, builds the bundle, creates the tag, and uploads the release asset.

## [0.6.0] - 2026-11-25

### Added

- Docker Status Badge with configurable Home Assistant count entities, compact status icons, zero and unavailable handling, healthy-state indication, dashboard actions, visual editor, documentation, and automated tests.

## [0.5.0] - 2026-11-24

### Changed

- Replaced Fullscreen Toggle Card with a native-style Fullscreen Toggle Badge for dashboard badge rows.
- Renamed the type from `custom:fullscreen-toggle-card` to `custom:fullscreen-toggle-badge`; state-specific text, icons, colours, and F11 support remain available.

## [0.4.0] - 2026-11-24

### Added

- Fullscreen Toggle Card with separate normal/fullscreen text, icons, and icon colours.
- Configurable button styling, icon placement, optional F11 handling, visual editor, documentation, and automated tests.
- Migration aliases for KTibow Fullscreen Card's `go_fullscreen` and `exit_fullscreen` text options.

## [0.3.5] - 2026-11-24

### Changed

- Multi Metric Graph Card columns now remain horizontal at narrow container widths by default.
- Added optional `stack_on_narrow: true` to restore vertical stacking below 420px when desired.

## [0.3.4] - 2026-11-24

### Added

- Added card-level and per-metric `value_position` controls, including horizontal and vertical graph centring.
- Added card-level and per-metric `value_size` controls for value text from 8px to 96px.

## [0.3.3] - 2026-11-24

### Changed

- Moved Multi Metric Graph Card labels, icons, and values into the graph area, with labels/icons left-aligned and values right-aligned.
- Added card-level `show_names` and per-metric `show_name` controls for hiding metric titles independently of icons.

## [0.3.2] - 2026-11-24

### Changed

- Reduced the Multi Metric Graph Card minimum `graph_height` from 60px to 16px and minimum `card_height` from 120px to 60px.
- Added a compact header treatment for fixed card heights below 120px.

## [0.3.1] - 2026-11-24

### Changed

- Left-aligned each Multi Metric Graph Card label and optional icon while keeping the entity value centred.
- Added optional `card_height` control for setting the total card height; graphs expand into the remaining space.

## [0.3.0] - 2026-11-24

### Added

- Multi Metric Graph Card for combining configurable Recorder graphs, labels, values, units, and optional icons in one responsive card.
- Per-metric graph bounds, precision, colours, thresholds, history duration, and visibility controls.
- Visual editor, card-picker metadata, documentation, development preview, and automated tests for the new card.

## [0.2.2] - 2026-11-24

### Changed

- Centred the Media Download Card summary/status row when `title: false` is used.
- Vertically aligned summary icons and numeric counts with consistent line height and tabular numerals.

## [0.2.1] - 2026-11-24

### Fixed

- Added horizontal inset between adjacent metric sparklines so graphs no longer meet at the centre divider.
- Made the card and `ha-card` explicitly fill their dashboard cell width.
- Switched Sections grid height reporting to automatic sizing and corrected standard card-size estimates, preventing neighbouring cards from overlapping the compact card.

## [0.2.0] - 2026-11-24

### Added

- Compact System Status Card with responsive two-row and single-row layouts.
- Batched Home Assistant Recorder history sparklines, timestamp-aware scaling, peak-preserving downsampling, thresholds, and per-metric graph controls.
- Supplementary entity states with labels, icons/status dots, and state-dependent colours.
- More-info interactions, keyboard accessibility, Sections sizing, card-picker metadata, and a visual entity editor.
- Deterministic browser development preview covering light/dark themes, mobile width, unavailable entities, missing history, titles, and additional metrics.
- Dedicated configuration documentation and mock-based data/rendering/lifecycle tests.

### Changed

- The shared HACS bundle and card catalogue now include both Compact System Status Card and Media Download Card.

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

[0.6.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.6.0
[0.5.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.5.0
[0.4.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.4.0
[0.3.5]: https://github.com/maael/home-assistant-custom/releases/tag/v0.3.5
[0.3.4]: https://github.com/maael/home-assistant-custom/releases/tag/v0.3.4
[0.3.3]: https://github.com/maael/home-assistant-custom/releases/tag/v0.3.3
[0.3.2]: https://github.com/maael/home-assistant-custom/releases/tag/v0.3.2
[0.3.1]: https://github.com/maael/home-assistant-custom/releases/tag/v0.3.1
[0.3.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.3.0
[0.2.2]: https://github.com/maael/home-assistant-custom/releases/tag/v0.2.2
[0.2.1]: https://github.com/maael/home-assistant-custom/releases/tag/v0.2.1
[0.2.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.2.0
[0.1.3]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.3
[0.1.2]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.2
[0.1.1]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.1
[0.1.0]: https://github.com/maael/home-assistant-custom/releases/tag/v0.1.0
