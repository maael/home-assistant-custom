import "./cards/media-download-card.js";
import "./cards/compact-system-status-card.js";

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
];
for (const card of cards) {
  if (!window.customCards.some((registered) => registered.type === card.type)) window.customCards.push(card);
}
