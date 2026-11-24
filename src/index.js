import "./cards/media-download-card.js";

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "media-download-card")) {
  window.customCards.push({
    type: "media-download-card",
    name: "Media Download Card",
    description: "Shows Radarr and Sonarr queue artwork with qBittorrent progress.",
    preview: false,
    documentationURL: "https://github.com/maael/home-assistant-custom/blob/main/docs/media-download-card.md",
  });
}
