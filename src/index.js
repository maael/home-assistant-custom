import "./cards/media-download-card.js";
import "./cards/compact-system-status-card.js";
import "./cards/multi-metric-graph-card.js";
import "./cards/fullscreen-toggle-card.js";

window.customCards = window.customCards || [];
const cards = [
  {
    type: "media-download-card",
    name: "Media Download Card",
    description: "Shows Radarr and Sonarr queue artwork with qBittorrent progress.",
    preview: false,
    documentationURL: "https://github.com/maael/home-assistant-custom/blob/main/docs/media-download-card.md",
  },
  {
    type: "compact-system-status-card",
    name: "Compact System Status Card",
    description: "Compact system metrics with historical sparklines and supplementary states.",
    preview: true,
    documentationURL: "https://github.com/maael/home-assistant-custom/blob/main/docs/compact-system-status-card.md",
  },
  {
    type: "multi-metric-graph-card",
    name: "Multi Metric Graph Card",
    description: "Multiple configurable Recorder history graphs in one card.",
    preview: true,
    documentationURL: "https://github.com/maael/home-assistant-custom/blob/main/docs/multi-metric-graph-card.md",
  },
  {
    type: "fullscreen-toggle-card",
    name: "Fullscreen Toggle Card",
    description: "A configurable fullscreen toggle with separate text, icons, and icon colours for each state.",
    preview: true,
    documentationURL: "https://github.com/maael/home-assistant-custom/blob/main/docs/fullscreen-toggle-card.md",
  },
];
for (const card of cards) {
  if (!window.customCards.some((registered) => registered.type === card.type)) window.customCards.push(card);
}
