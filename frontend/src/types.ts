// Minimal typings for the parts of Home Assistant's `hass` object we use.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    entity_picture?: string;
  };
  last_changed: string;
  last_updated: string;
}

export interface HassConnection {
  subscribeMessage<T>(
    callback: (event: T) => void,
    message: Record<string, unknown>,
  ): Promise<() => Promise<void>>;
}

export interface Hass {
  states: Record<string, HassEntity>;
  user?: { is_admin: boolean; name: string };
  connection: HassConnection;
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  hassUrl(path?: string): string;
}

// Mirrors custom_components/visio/schema.py
export type CameraMode = "live" | "snapshot" | "placeholder";
export type Fallback = "snapshot" | "placeholder" | "none";

export interface EntityProfile {
  name?: string;
  order?: number;
  hidden?: boolean;
  tile?: string;
  mode?: CameraMode;
  interval?: number;
  fallback?: Fallback;
  placeholder_text?: string;
  placeholder_url?: string;
  motion_entity?: string;
  /** Covers: hide the tilt control (some integrations report tilt the device lacks). */
  hide_tilt?: boolean;
  /** Battery sensor to show on the tile; auto-detected from the device when unset. */
  battery_entity?: string;
  /** Don't show a battery level (e.g. plugged-in devices that still report one). */
  hide_battery?: boolean;
}

export interface Layout {
  name?: string;
  columns?: number;
  /** Legacy, ignored (the clock was removed). */
  show_clock?: boolean;
  entities?: string[];
  /** Device types shown when `entities` is empty, e.g. ["camera"]; empty = all types. */
  domains?: string[];
}

export type BlindMode = "auto" | "manual";
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Times are local "HH:MM" (24 h); a missing time means no action that day. */
export type DayTimes = { open?: string; close?: string };

export interface BlindSchedule {
  id: string;
  name?: string;
  enabled?: boolean;
  entities?: string[];
  days?: Partial<Record<Day, DayTimes>>;
}

export interface BlindsConfig {
  mode: BlindMode;
  schedules: BlindSchedule[];
}

export interface UpdatesConfig {
  mode: "manual" | "weekly";
  day: Day;
  time: string;
  backup: boolean;
}

export interface VisioConfig {
  entities: Record<string, EntityProfile>;
  layouts: Record<string, Layout>;
  blinds?: BlindsConfig;
  updates?: UpdatesConfig;
}

export interface UpdateItem {
  entity_id: string;
  title: string;
  installed: string | null;
  latest: string | null;
  available: boolean;
  in_progress: boolean;
  kind: "os" | "core" | "other";
  platform: string | null;
  release_url: string | null;
}

export interface UpdateResult {
  entity_id: string;
  title: string;
  from: string | null;
  to: string | null;
  ok: boolean;
  started?: boolean;
  error: string | null;
}

export interface UpdateRun {
  time: string;
  trigger: "manual" | "scheduled" | "resumed";
  summary: string;
  results: UpdateResult[];
  run_open?: boolean;
}

export interface UpdatesStatus {
  items: UpdateItem[];
  running: boolean;
  pending: string[] | null;
  history: UpdateRun[];
}
