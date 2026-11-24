import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const window = new Window({ url: "http://homeassistant.local/" });
const timers = new Set();
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (callback, delay, ...args) => {
  const timer = nativeSetTimeout((...callbackArgs) => { timers.delete(timer); callback(...callbackArgs); }, delay, ...args);
  timers.add(timer);
  return timer;
};
globalThis.clearTimeout = (timer) => { timers.delete(timer); nativeClearTimeout(timer); };
Object.assign(globalThis, {
  window, document: window.document, HTMLElement: window.HTMLElement,
  customElements: window.customElements, location: window.location,
  ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
});
await import("../src/index.js");
after(async () => {
  for (const timer of timers) nativeClearTimeout(timer);
  timers.clear();
  await window.happyDOM.abort();
  globalThis.setTimeout = nativeSetTimeout;
  globalThis.clearTimeout = nativeClearTimeout;
});

test("registers once, polls through callWS, renders a 4x2 scrollable card, and cleans up", async () => {
  await import("../src/index.js");
  assert.equal(window.customCards.filter((card) => card.type === "media-download-card").length, 1);
  const calls = [];
  const responses = {
    radarr: { movies: { release: { title: "Movie", download_id: "ABC", progress: "50%" } } },
    sonarr: { shows: { episode: { title: "Show", download_id: "DEF", season_number: 3, episode_number: 9 } } },
    qbittorrent: { torrents: {
      movie: { id: "abc", percent_done: "51", status: "downloading", eta: "00:08:16" },
      show: { id: "def", percent_done: "30", status: "pausedDL" },
    } },
  };
  const card = document.createElement("media-download-card");
  card.setConfig({ title: "Downloads", behaviour: { refresh_interval: 3600 }, qbittorrent: { download_speed_entity: "sensor.qbittorrent_download_speed" } });
  card.hass = {
    connection: { connected: true },
    states: { "sensor.qbittorrent_download_speed": { state: "12.4", attributes: { device_class: "data_rate", unit_of_measurement: "MB/s", friendly_name: "qBittorrent Download speed" } } },
    formatEntityState: (state) => `${state.state} ${state.attributes.unit_of_measurement}`,
    callWS: async (message) => { calls.push(message); return responses[message.domain]; },
  };
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(calls.map((call) => call.domain).sort(), ["qbittorrent", "radarr", "sonarr"]);
  assert.ok(calls.every((call) => call.return_response === true));
  assert.equal(card.shadowRoot.querySelectorAll(".item").length, 2);
  assert.equal(card.shadowRoot.querySelector(".grid").classList.contains("scrollable"), true);
  assert.match(card.shadowRoot.textContent, /S03E09/);
  assert.match(card.shadowRoot.textContent, /8m 16s/);
  assert.match(card.shadowRoot.textContent, /Paused/);
  const renderedItems = [...card.shadowRoot.querySelectorAll(".item")];
  const movieItem = renderedItems.find((item) => item.getAttribute("aria-label").startsWith("Movie,"));
  const tvItem = renderedItems.find((item) => item.getAttribute("aria-label").startsWith("Show,"));
  assert.equal(movieItem.querySelector(".episode").hidden, true);
  assert.equal(movieItem.querySelector(".eta").textContent, "8m 16s");
  assert.equal(tvItem.querySelector(".episode").hidden, false);
  assert.equal(tvItem.querySelector(".episode").textContent, "S03E09");
  const summary = card.shadowRoot.querySelector(".summary");
  assert.equal(card.shadowRoot.querySelector(".heading").textContent, "Downloads");
  assert.deepEqual([...summary.querySelectorAll("ha-icon")].map((icon) => icon.getAttribute("icon")), ["mdi:movie-open", "mdi:television", "mdi:magnet"]);
  assert.deepEqual([...summary.querySelectorAll(".stat-value")].map((value) => value.textContent), ["1", "1", "2"]);
  assert.match(card.shadowRoot.querySelector("style").textContent, /\.stat-value \{ display:block; line-height:16px;/);
  assert.match(summary.title, /1 movie · 1 TV show · 2 torrents · Download speed 12.4 MB\/s/);
  card.hass = { ...card._hass, states: { ...card._hass.states, "sensor.qbittorrent_download_speed": { state: "8.1", attributes: { unit_of_measurement: "MB/s" } } } };
  assert.match(summary.textContent, /↓ 8.1 MB\/s/);
  card.remove();
  const generation = card._generation;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(card._generation, generation);
});

test("keeps last good partial data and visibly marks it stale", async () => {
  let failQb = false;
  const card = document.createElement("media-download-card");
  card.setConfig({ title: false, behaviour: { refresh_interval: 3600 } });
  card.hass = { connection: { connected: true }, callWS: async ({ domain }) => {
    if (domain === "radarr") return { movies: { release: { title: "Movie", download_id: "ABC" } } };
    if (domain === "sonarr") return { shows: {} };
    if (failQb) throw new Error("offline");
    return { torrents: { release: { id: "abc", status: "downloading", percent_done: 10 } } };
  } };
  document.body.append(card);
  await new Promise((resolve) => setTimeout(resolve, 20));
  failQb = true;
  await card._refresh(card._generation);
  assert.equal(card.shadowRoot.querySelectorAll(".item").length, 1);
  assert.match(card.shadowRoot.querySelector(".summary").textContent, /Stale \(qbittorrent\)/);
  assert.equal(card.shadowRoot.querySelector(".heading").hidden, true);
  assert.equal(card.shadowRoot.querySelector(".header").classList.contains("titleless"), true);
  assert.match(card.shadowRoot.querySelector("style").textContent, /\.header\.titleless \.summary \{ justify-content:center; \}/);
  card.remove();
});
