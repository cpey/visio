// `npm run dev`: mounts <visio-panel> with a mock hass (no Home Assistant needed).
// Snapshots are generated SVGs; live view reports "not supported" and falls back.

import "../panel";
import type { Hass, HassEntity, VisioConfig } from "../types";

function svgSnapshot(label: string, hue: number): string {
  const time = new Date().toLocaleTimeString();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <rect width="100%" height="100%" fill="hsl(${hue} 30% 20%)"/>
    <text x="50%" y="45%" fill="#fff" font-size="36" text-anchor="middle" font-family="sans-serif">${label}</text>
    <text x="50%" y="60%" fill="#ccc" font-size="24" text-anchor="middle" font-family="monospace">${time}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function camera(id: string, name: string): HassEntity {
  return {
    entity_id: id,
    state: "idle",
    attributes: { friendly_name: name, entity_picture: `mock://${id}` },
    last_changed: "",
    last_updated: "",
  };
}

const states: Record<string, HassEntity> = {
  "camera.front_door": camera("camera.front_door", "Front door"),
  "camera.garden": camera("camera.garden", "Garden"),
  "camera.driveway": camera("camera.driveway", "Driveway"),
  "camera.backyard": camera("camera.backyard", "Backyard"),
  "cover.living_room_shutters": {
    entity_id: "cover.living_room_shutters",
    state: "open",
    attributes: { friendly_name: "Living room shutters", supported_features: 1 | 2 | 4 | 128, current_position: 60, current_tilt_position: 30 },
    last_changed: "",
    last_updated: "",
  },
  "cover.kitchen_blind": {
    entity_id: "cover.kitchen_blind",
    state: "open",
    attributes: { friendly_name: "Kitchen blind", supported_features: 1 | 2 | 4, current_position: 100 },
    last_changed: "",
    last_updated: "",
  },
  "binary_sensor.garden_motion": {
    entity_id: "binary_sensor.garden_motion",
    state: "off",
    attributes: { friendly_name: "Garden motion" },
    last_changed: "",
    last_updated: "",
  },
};

let restartUntil = 0;
// ?down=1 simulates unresponsive blinds until "Reconnect" (visio/reconnect).
let blindsDown = new URLSearchParams(location.search).get("down") === "1";

let config: VisioConfig = {
  entities: {
    "camera.front_door": { mode: "live", order: 1 },
    "camera.garden": { interval: 3, motion_entity: "binary_sensor.garden_motion", order: 2 },
    "camera.backyard": { mode: "placeholder", placeholder_text: "View in Aosu app" },
  },
  layouts: { default: { name: "Cameras", columns: 2, domains: ["camera"] }, blinds: { name: "Blinds", domains: ["cover"] } },
  blinds: {
    mode: "auto",
    schedules: [
      {
        id: "weekdays",
        name: "All blinds",
        enabled: true,
        entities: ["cover.kitchen_blind", "cover.living_room_shutters"],
        days: {
          mon: { open: "07:30", close: "21:30" },
          tue: { open: "07:30", close: "21:30" },
          wed: { open: "07:30", close: "21:30" },
          thu: { open: "07:30", close: "21:30" },
          fri: { open: "07:30", close: "22:00" },
          sat: { open: "09:00", close: "22:00" },
          sun: { open: "09:00", close: "21:30" },
        },
      },
    ],
  },
};

const hues: Record<string, number> = { "camera.front_door": 210, "camera.garden": 120, "camera.driveway": 30 };

function makeHass(): Hass {
  const current = { ...states };
  if (blindsDown) {
    for (const id of Object.keys(current)) if (id.startsWith("cover.")) current[id] = { ...current[id], state: "unavailable" };
  }
  return {
    states: current,
    user: { is_admin: true, name: "Dev" },
    hassUrl: (path = "") => {
      const match = path.match(/^mock:\/\/([^?&]+)/);
      return match ? svgSnapshot(states[match[1]].attributes.friendly_name ?? match[1], hues[match[1]] ?? 0) : path;
    },
    callWS: async <T,>(msg: Record<string, unknown>): Promise<T> => {
      switch (msg.type) {
        case "visio/config/get":
          return structuredClone(config) as T;
        case "visio/config/set":
          config = structuredClone(msg.config as VisioConfig);
          return structuredClone(config) as T;
        case "visio/info":
          if (Date.now() < restartUntil) throw { code: 3, message: "Connection lost" };
          return { version: restartUntil ? "0.3.0" : "0.2.0-dev+ab4b01a" } as T;
        case "visio/updates/status":
          // Simulated restart after "Update" (see visio/updates/run below).
          if (Date.now() < restartUntil) throw { code: 3, message: "Connection lost" };
          return {
            running: false,
            pending: null,
            items: [
              { entity_id: "update.home_assistant_operating_system_update", title: "Home Assistant Operating System", installed: "18.3", latest: "18.4", available: true, in_progress: false, kind: "os", platform: "hassio", release_url: "https://github.com/home-assistant/operating-system/releases" },
              { entity_id: "update.home_assistant_core_update", title: "Home Assistant Core", installed: "2026.9.4", latest: "2026.9.5", available: true, in_progress: false, kind: "core", platform: "hassio", release_url: null },
              { entity_id: "update.tapo_cameras_control_update", title: "Tapo: Cameras Control", installed: "7.2.0", latest: "7.3.1", available: true, in_progress: false, kind: "other", platform: "hacs", release_url: null },
              { entity_id: "update.tailscale_update", title: "Tailscale", installed: "0.30.1", latest: "0.30.1", available: false, in_progress: false, kind: "other", platform: "hassio", release_url: null },
            ],
            history: [
              { time: "2026-09-27T04:00:12", trigger: "scheduled", summary: "All updates installed", results: [
                { entity_id: "update.visio_update", title: "Visio", from: "0.1.0", to: "0.1.1", ok: true, error: null },
              ] },
            ],
          } as T;
        case "visio/reconnect":
          setTimeout(() => {
            blindsDown = false;
            panel.hass = makeHass();
          }, 3000);
          return { reloaded: ["Norman ShadeAuto"], errors: [] } as T;
        case "visio/updates/check":
          await new Promise((r) => setTimeout(r, 1500));
          return { ...(await makeHass().callWS<object>({ type: "visio/updates/status" })), last_check: new Date().toISOString(), errors: [] } as T;
        case "visio/updates/run":
          restartUntil = Date.now() + 8000;
          return { started: true } as T;
        case "visio/blinds/mode":
          config = { ...config, blinds: { ...config.blinds!, mode: msg.mode as "auto" | "manual" } };
          return structuredClone(config) as T;
        case "camera/capabilities":
          return { frontend_stream_types: [] } as T;
        case "call_service": {
          // Minimal cover simulation for the dev server.
          const target = (msg.target as { entity_id: string | string[] }).entity_id;
          const data = (msg.service_data ?? {}) as Record<string, number>;
          for (const id of Array.isArray(target) ? target : [target]) {
            const e = states[id];
            const attrs = { ...e.attributes };
            if (msg.service === "open_cover") attrs.current_position = 100;
            if (msg.service === "close_cover") attrs.current_position = 0;
            if (msg.service === "set_cover_position") attrs.current_position = data.position;
            if (msg.service === "set_cover_tilt_position") attrs.current_tilt_position = data.tilt_position;
            states[id] = { ...e, attributes: attrs, state: attrs.current_position ? "open" : "closed" };
          }
          setTimeout(() => (panel.hass = makeHass()), 300);
          return null as T;
        }
        default:
          throw new Error(`mock: unsupported ${String(msg.type)}`);
      }
    },
    connection: {
      subscribeMessage: async () => async () => undefined,
    },
  };
}

const panel = document.createElement("visio-panel") as HTMLElement & { hass: Hass };
panel.style.height = "100vh";
document.body.append(panel);
panel.hass = makeHass();

// Toggle the garden motion sensor every 10 s to exercise the highlight.
setInterval(() => {
  const m = states["binary_sensor.garden_motion"];
  states["binary_sensor.garden_motion"] = { ...m, state: m.state === "on" ? "off" : "on" };
  panel.hass = makeHass();
}, 10000);
