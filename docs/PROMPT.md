# Agent brief: Home Assistant Custom

## Mission

Set up and maintain a single GitHub repository for my custom Home Assistant dashboard cards, starting with a Media Download Card. Deliver working code, tests, documentation and an installable HACS dashboard release. Do not stop at a proposal.

## Repository and permissions

- This file lives at `docs/PROMPT.md` relative to the repository root. Run from the root (`git rev-parse --show-toplevel`). Preserve this brief.
- GitHub CLI (`gh`) is already authorised as `maael`. Verify with `gh auth status` and `gh api user --jq .login`. Do not request or print tokens.
- Inspect `git status`, remotes, current branch, existing files and `gh repo view` before changing anything. Use the existing repository if it belongs to `maael`; if no remote exists, use `maael/home-assistant-custom` as the proposed name. Do not overwrite another repository, force-push, discard unrelated changes or change visibility without approval. If creating a new repository, confirm visibility first (public is recommended for HACS).
- Use MIT licensing for new original code unless the existing repository specifies otherwise. Never publish personal configuration, credentials, private addresses, raw download lists or API keys.
- You may commit and push the requested implementation and publish an initial prerelease after checks pass. Respect branch protection; use a PR if required. Report anything requiring manual approval.

## Architecture and distribution

Use a single HACS Dashboard repository containing multiple independently configurable custom elements, installed and updated as one bundle. Verify current HACS publishing requirements against https://www.hacs.xyz/docs/publish/plugin/ and current Home Assistant frontend documentation before finalising packaging. Prefer a single self-contained bundled entry point to avoid missing imports and stale browser caches. No external runtime dependencies or CDN JavaScript.

Suggested structure (adapt to existing conventions):

```text
README.md
LICENSE
CHANGELOG.md
hacs.json
package.json
src/
  index.js
  cards/media-download-card.js
  cards/media-download-data.js
dist/
  home-assistant-custom.js
docs/
  PROMPT.md
  media-download-card.md
tests/
  fixtures/
.github/workflows/
  ci.yml
  release.yml
```

Use a minimal JavaScript toolchain (e.g. esbuild and Node's built-in test runner). Commit a lockfile, pin a supported Node version, make builds reproducible and document `npm ci`, `npm test`, `npm run build`. Ensure HACS can obtain the actual built JS from the tagged release or repository according to its current requirements. Configure `hacs.json` with name and filename as appropriate. Register each custom element once and expose card picker metadata via `window.customCards`. Adding another card should require a new module, import, tests and documentation, not another repository. Keep backend integrations and YAML deployment outside this dashboard bundle.

## First card: Media Download Card

Custom element: `media-download-card`. Home Assistant dashboard YAML type: `custom:media-download-card`.

I have Radarr, Sonarr, qBittorrent and Seerr integrations. The first card needs only the first three. It should show movie and TV artwork for downloads currently in their queues, joined to qBittorrent by torrent ID. No separate backend, API keys, direct browser requests to local service APIs, or Seerr dependency. If an existing `media-download-card.js` is supplied, inspect and reuse suitable parts, but fix defects rather than blindly copying it. If absent, implement from this brief.

### Data contracts

The following are representative shapes from the integration responses; identifiers and artwork URLs below are synthetic placeholders. Action names and required parameters have NOT been confirmed on the live Home Assistant installation. Start with configurable defaults `radarr.get_queue`, `sonarr.get_queue`, `qbittorrent.get_torrents`; verify actual integration documentation/source if identifiable. Do not claim live compatibility without testing. Allow arbitrary per-integration `service_data` and optional `entry_id`. Use HA's authenticated frontend WebSocket service call with `return_response: true` where supported; handle response envelopes and entity-keyed responses. Do not silently treat a missing response key as an empty queue.

```yaml
# Radarr
movies:
  Example Movie Release:
    title: Example Movie
    download_title: Example Movie Release
    download_id: ABCDEF1234567890ABCDEF1234567890ABCDEF12
    progress: '47.17%'
    size: 1818367140
    size_left: 960631972
    status: downloading
    tracked_download_state: downloading
    time_left: '00:08:16'
    images:
      poster: https://example.com/movie.jpg
# Sonarr (separate response)
shows:
  Example Show Release:
    title: Example Show
    download_id: 1234567890ABCDEF1234567890ABCDEF12345678
    season_number: 1
    episode_identifier: 'S01 (2 episodes)'
    is_season_pack: true
    episode_count: 2
    episode_range: E07-E08
    progress: '32.47%'
    time_left: None
    images:
      poster: https://example.com/show.jpg
# qBittorrent (separate response)
torrents:
  Example Movie Release:
    id: abcdef1234567890abcdef1234567890abcdef12
    percent_done: '47.17'
    status: downloading
    eta: '00:08:16'
    ratio: '0.00'
```

All three top-level collections are mappings keyed by release title; tolerate arrays too. qBittorrent IDs are lowercase, Arr IDs uppercase. Normalise case and whitespace; do not join by title. qBittorrent percentage is already 0–100, not 0–1. Prefer valid qBittorrent progress, fall back to Arr progress or size/size_left. Deduplicate by hash, aggregating episode information rather than losing it. Show unmatched Arr entries as unknown, not falsely paused. Ignore unrelated qBittorrent torrents. Hide completed/seeding downloads by default. Support qBittorrent states including downloading, forcedDL, stalledDL, queuedDL, pausedDL, stoppedDL, checkingDL and metaDL; distinguish errors and unknown states.

The supplied qBittorrent response does NOT expose individual download speed. If a supported numeric speed field is present, zero means inactive and positive means active (subject to state). Otherwise use torrent status as a proxy and document that this cannot guarantee exact zero-speed detection. Do not invent speed. Parse ETA strings including hours beyond 24, null, literal `None`, and invalid or sentinel values (observed examples include `91793:10:57` and `120303:19:05`); treat implausible sentinel ETAs as unknown, not real estimates. Support numeric seconds where documented. Use Arr `time_left` as fallback where appropriate.

### Visual requirements

- Default title: Media Downloads; optional active/inactive summary.
- Default 4 columns and 2 visible rows; configurable independently. `rows: 0` means unlimited. Vertical scrolling for overflow; if scrolling disabled, show only the configured number of rows. Preserve scroll position on refresh. Do not cut off the second row's metadata.
- Consistent 2:3 posters, 8px gaps and 8px rounded corners. Responsive to card width, not viewport width. Keep movie and TV poster rows aligned.
- No media title by default (poster is enough); optional title, accessible labels and missing/broken artwork fallback.
- Floating percentage centred near bottom of poster, white bold text, semi-transparent black rounded background and shadow for readability. Default one decimal.
- Green progress bar flush with bottom edge of poster, 5px high. Grey for inactive items.
- Greyscale/dim inactive artwork, centred pause icon by default. Clearly distinguish stalled, queued, paused, error and unknown status in text; do not claim unknown is paused.
- TV episode information below poster: `S03E09`, `S01E07–08`, or `Season 1` for a confirmed full-season pack. No episode label for movies; reserve alignment space if needed.
- ETA below both movie and TV posters, formatted e.g. `8m 16s`, `2h 15m`, `3d 8h`. For inactive entries show status instead of misleading ETA; active unknown ETA labelled explicitly.
- Read-only: no pause, delete or cancellation actions. Use HA theme variables, keyboard-accessible scrolling, sensible contrast and accessible text.
- Poll every 10 seconds by default only while connected; avoid overlapping requests, stale responses and leaking timers/observers. Preserve last good data on failure, visibly mark it stale, handle partial failures without misrepresenting states. Provide loading, empty and useful error states. Avoid rebuilding all poster DOM unnecessarily. Escape untrusted strings, validate image URLs and config values.

### Configuration contract

```yaml
type: custom:media-download-card
title: Media Downloads
radarr:
  action: get_queue
sonarr:
  action: get_queue
qbittorrent:
  action: get_torrents
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

All settings above are defaults; minimal YAML should work once actions are confirmed. Support per-domain `service_data` and `entry_id` overrides. Validate configuration and document every option. Sort active first, then use a deterministic secondary order. No visual config editor required for v0.1.0.

## Verification and delivery

1. Inspect existing repository and authenticate identity. Verify HACS requirements and action contracts where possible.
2. Implement card, modular data transformations, packaging and documentation. Add synthetic fixtures, never publish my real queue data.
3. Test hash matching, percentage parsing, duplicate/season packs, state mapping, speed present/absent, unknown and huge ETA, completed filtering, missing data, response envelopes, config defaults and overrides. Test rendering in a browser with mocked HA calls if feasible, including 4×2 scrolling, mixed movie/TV alignment, overlay placement and inactive styling. Check cleanup and errors. Run clean build and tests; verify bundle registers the element.
4. Document HACS custom repository installation (Dashboard category), resource URL/type if manual registration is needed, minimal and full YAML, troubleshooting via Developer Tools → Actions, action parameter overrides, manual local installation fallback, updates and rollback. Clearly label unverified live action names and speed limitation. Include a screenshot/mock preview only if actually produced.
5. Set up CI for tests/build; automate tagged release packaging without duplicate or recursive release jobs. Verify release asset naming and contents. Start at `v0.1.0` prerelease if no existing versions; otherwise respect existing version history. Do not advertise as stable until live validation. Explain any HACS prerelease opt-in required.
6. Commit and push scoped changes, publish the prerelease if permitted and checks pass, verify remote release and asset. If blocked, leave a usable local build and report exact next steps. Do not fabricate success or test results.

Finish with repository URL, commit/release identifiers, files changed, test results, exact Home Assistant installation instructions, minimal YAML, outstanding assumptions and anything I need to test on my live instance. Keep this brief in `docs/PROMPT.md` for future agents; update documentation when behaviour changes.
