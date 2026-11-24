import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMediaDownloads, classifyTorrent, extractCollection, formatDataRate, formatEta,
  mergeConfig, parseEta, parsePercent, serviceCallMessage, totalTorrentDownloadSpeed,
} from "../src/cards/media-download-data.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/responses.json", import.meta.url)));

test("extracts direct, wrapped, and entity-keyed response collections", () => {
  assert.equal(extractCollection(fixture.radarr, "movies").length, 1);
  assert.equal(extractCollection(fixture.sonarr, "shows").length, 2);
  assert.equal(extractCollection(fixture.qbittorrent, "torrents").length, 3);
  assert.throws(() => extractCollection({ response: {} }, "movies"), /required 'movies'/);
});

test("matches hashes case-insensitively, ignores unrelated torrents, and deduplicates episodes", () => {
  const items = buildMediaDownloads({
    movies: extractCollection(fixture.radarr, "movies"),
    shows: extractCollection(fixture.sonarr, "shows"),
    torrents: extractCollection(fixture.qbittorrent, "torrents"),
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Example Movie");
  assert.equal(items[0].active, true);
  assert.equal(items[0].progress, 47.17);
  assert.equal(items[1].kind, "paused");
  assert.equal(items[1].eta, null);
  assert.equal(items[1].episode, "S01E07–08, S01E09");
});

test("unmatched Arr entries are unknown rather than paused", () => {
  const [item] = buildMediaDownloads({ movies: [{ title: "Missing torrent", download_id: "ABC", progress: "10%" }] });
  assert.equal(item.matched, false);
  assert.equal(item.kind, "unknown");
  assert.equal(item.label, "Unknown status");
});

test("uses qBittorrent percent as 0-100 and falls back to Arr size progress", () => {
  assert.equal(parsePercent("47.17%"), 47.17);
  const [item] = buildMediaDownloads({ movies: [{ download_id: "a", size: 1000, size_left: 250 }] });
  assert.equal(item.progress, 75);
});

test("maps download states and aggregates numeric speed when supplied", () => {
  assert.equal(classifyTorrent({ status: "forcedDL" }).active, true);
  assert.equal(classifyTorrent({ status: "downloading", dlspeed: 0 }).kind, "stalled");
  assert.equal(classifyTorrent({ status: "downloading", dlspeed: 1 }).active, true);
  assert.equal(classifyTorrent({ status: "stalledDL" }).label, "Stalled");
  assert.equal(classifyTorrent({ status: "queuedDL" }).kind, "queued");
  assert.equal(classifyTorrent({ status: "checkingDL" }).kind, "pending");
  assert.equal(classifyTorrent({ status: "mystery" }).kind, "unknown");
  assert.equal(totalTorrentDownloadSpeed([{ dlspeed: 1200 }, { download_speed: 300 }]), 1500);
  assert.equal(totalTorrentDownloadSpeed([{ status: "downloading" }]), null);
  assert.equal(formatDataRate(12500000), "12.5 MB/s");
});

test("parses normal and long-hour ETAs but rejects huge sentinels", () => {
  assert.equal(parseEta("27:01:02"), 97262);
  assert.equal(parseEta(496), 496);
  assert.equal(parseEta("None"), null);
  assert.equal(parseEta("91793:10:57"), null);
  assert.equal(parseEta("bad"), null);
  assert.equal(formatEta(496), "8m 16s");
  assert.equal(formatEta(11700), "3h 15m");
  assert.equal(formatEta(288000), "3d 8h");
});

test("filters completed and inactive downloads", () => {
  const input = {
    movies: [{ title: "Done", download_id: "a" }, { title: "Paused", download_id: "b" }],
    torrents: [{ id: "a", status: "seeding", percent_done: 100 }, { id: "b", status: "pausedDL", percent_done: 50 }],
  };
  assert.deepEqual(buildMediaDownloads(input).map((item) => item.title), ["Paused"]);
  assert.equal(buildMediaDownloads(input, { hide_completed: false, hide_inactive: true }).length, 0);
});

test("merges defaults, validates values, and creates WebSocket service messages", () => {
  const config = mergeConfig({ title: false, appearance: { columns: 6, rows: 0 }, radarr: { entry_id: "entry", service_data: { extra: true } } });
  assert.equal(config.title, false);
  assert.equal(config.appearance.columns, 6);
  assert.equal(config.appearance.rows, 0);
  assert.equal(config.sonarr.action, "get_queue");
  assert.deepEqual(serviceCallMessage("radarr", config.radarr), {
    type: "call_service", domain: "radarr", service: "get_queue",
    service_data: { extra: true, entry_id: "entry" }, return_response: true,
  });
  assert.throws(() => mergeConfig({ qbittorrent: { service_data: "bad" } }), /service_data/);
  assert.throws(() => mergeConfig({ qbittorrent: { download_speed_entity: "switch.bad" } }), /sensor entity ID/);
  assert.throws(() => mergeConfig({ title: 123 }), /string or false/);
});
