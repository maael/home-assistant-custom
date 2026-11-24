class HaCard extends HTMLElement {}
class HaIcon extends HTMLElement {}
customElements.define("ha-card", HaCard);
customElements.define("ha-icon", HaIcon);
await import("../src/index.js");

const baseStates = {
  "sensor.nas_cpu": state("12", "CPU usage", "%", "mdi:cpu-64-bit"),
  "sensor.nas_ram": state("46", "RAM usage", "%", "mdi:memory"),
  "sensor.nas_disk": state("71", "Disk usage", "%", "mdi:harddisk"),
  "sensor.nas_temp": state("42.6", "CPU temperature", "°C", "mdi:thermometer"),
  "sensor.nas_ip": state("192.168.4.204", "LAN IP", null, "mdi:network"),
  "sensor.nas_status": state("online", "Server status", null, "mdi:server"),
  "sensor.ups": state("unavailable", "UPS", null, "mdi:battery-alert"),
  "sensor.no_history": state("28", "Archive disk", "%", "mdi:archive"),
};

function state(value, friendlyName, unit, icon) {
  return { state: value, attributes: { friendly_name: friendlyName, ...(unit ? { unit_of_measurement: unit } : {}), ...(icon ? { icon } : {}) }, last_updated: "2026-01-01T00:00:00Z" };
}

function mockHass(states = baseStates) {
  return {
    states, locale: { language: "en" }, connection: { connected: true },
    callWS: async (message) => {
      const start = Date.parse(message.start_time); const end = Date.parse(message.end_time);
      return Object.fromEntries(message.entity_ids.filter((id) => id !== "sensor.no_history").map((id, entityIndex) => {
        const numeric = Number(states[id]?.state);
        const baseline = Number.isFinite(numeric) ? numeric : 30;
        const points = Array.from({ length: 48 }, (_, index) => {
          const wave = Math.sin(index * 0.62 + entityIndex) * (entityIndex === 0 ? 8 : 4);
          const peak = index === 31 ? (entityIndex + 1) * 7 : 0;
          return { s: (baseline + wave + peak).toFixed(2), lu: (start + ((end - start) * index) / 47) / 1000 };
        });
        return [id, points];
      }));
    },
  };
}

const examples = [
  ["Default two-row NAS status", "", {
    metrics: [
      { entity: "sensor.nas_cpu", name: "CPU", color: "#65b7e8", min: 0, max: 100 },
      { entity: "sensor.nas_ram", name: "RAM", color: "#b09be9", min: 0, max: 100 },
    ],
    details: [
      { entity: "sensor.nas_ip", icon: "mdi:network", show_icon: true },
      { entity: "sensor.nas_status", icon: "mdi:circle", show_icon: true, state_colors: { online: "#4caf50", offline: "#f44336", unavailable: "#9e9e9e" }, state_labels: { online: "Online" } },
    ],
  }],
  ["Single-row layout", "", {
    layout: "single-row", show_icons: true,
    metrics: [{ entity: "sensor.nas_cpu", name: "CPU", color: "#65b7e8", min: 0, max: 100 }, { entity: "sensor.nas_temp", name: "Temp", color: "#ff9f43", decimals: 1 }],
    details: [{ entity: "sensor.nas_status", icon: "mdi:circle", show_icon: true, state_colors: { online: "#4caf50" }, state_labels: { online: "Online" } }],
  }],
  ["Optional title and four metrics", "", {
    title: "Lovelace NAS", show_title: true, show_icons: true,
    metrics: [
      { entity: "sensor.nas_cpu", name: "CPU", color: "#65b7e8", min: 0, max: 100 },
      { entity: "sensor.nas_ram", name: "RAM", color: "#b09be9", min: 0, max: 100 },
      { entity: "sensor.nas_disk", name: "Disk", color: "#64c987", min: 0, max: 100, color_thresholds: [{ value: 70, color: "#ff9800" }, { value: 90, color: "#f44336" }] },
      { entity: "sensor.nas_temp", name: "Temp", color: "#ff9f43", decimals: 1 },
    ],
    details: [{ entity: "sensor.nas_ip", icon: "mdi:network", show_icon: true }],
  }],
  ["Unavailable and missing Recorder history", "", {
    show_icons: true,
    metrics: [{ entity: "sensor.ups", name: "UPS" }, { entity: "sensor.no_history", name: "Archive", color: "#64c987" }],
    details: [{ entity: "sensor.nas_status", name: "Status", show_name: true, icon: "mdi:circle", show_icon: true, state_colors: { online: "#4caf50" } }],
  }],
  ["Dark theme", "dark", {
    metrics: [{ entity: "sensor.nas_cpu", name: "CPU", color: "#65b7e8", min: 0, max: 100 }, { entity: "sensor.nas_ram", name: "RAM", color: "#b09be9", min: 0, max: 100 }],
    details: [{ entity: "sensor.nas_ip", icon: "mdi:network", show_icon: true }, { entity: "sensor.nas_status", icon: "mdi:circle", show_icon: true, state_colors: { online: "#66bb6a" }, state_labels: { online: "Online" } }],
  }],
  ["Narrow mobile width", "mobile", {
    metrics: [{ entity: "sensor.nas_cpu", name: "CPU", color: "#65b7e8", min: 0, max: 100 }, { entity: "sensor.nas_ram", name: "RAM", color: "#b09be9", min: 0, max: 100 }],
    details: [{ entity: "sensor.nas_ip", icon: "mdi:network", show_icon: true }, { entity: "sensor.nas_status", icon: "mdi:circle", show_icon: true, state_colors: { online: "#4caf50" }, state_labels: { online: "Online" } }],
  }],
];

const gallery = document.querySelector("#gallery");
for (const [heading, className, cardConfig] of examples) {
  const section = document.createElement("section"); section.className = "example";
  const title = document.createElement("h2"); title.textContent = heading;
  const frame = document.createElement("div"); frame.className = `frame ${className}`;
  const card = document.createElement("compact-system-status-card");
  card.setConfig({ hours_to_show: 6, refresh_interval: 3600, show_graphs: true, graph_opacity: 0.35, graph_fill_opacity: 0.12, ...cardConfig });
  card.hass = mockHass(); frame.append(card); section.append(title, frame); gallery.append(section);
}
