// Plugin registry: tile renderers and per-domain settings.
// Adding a device type (e.g. switch, cover) = add a tile component + a domain entry.

import type { EntityProfile } from "../types";
import type { ResolvedTile } from "../lib/resolve";
import { BlindModeControl } from "./BlindModeControl";
import { CoverGroupControl } from "./CoverGroupControl";
import { ScheduleEditor } from "./ScheduleEditor";
import { CoverTile } from "./CoverTile";
import { LiveTile } from "./LiveTile";
import { PlaceholderTile } from "./PlaceholderTile";
import { SnapshotTile } from "./SnapshotTile";
import type { DomainDefinition, FieldSpec, TileDefinition } from "./types";

export const TILES: Record<string, TileDefinition> = {
  "camera-live": { component: LiveTile, expandable: true },
  "camera-snapshot": { component: SnapshotTile, expandable: true },
  placeholder: { component: PlaceholderTile, expandable: false },
  cover: { component: CoverTile, expandable: false },
};

export const COMMON_FIELDS: FieldSpec[] = [
  { key: "name", label: "Display name", kind: "text" },
  { key: "order", label: "Order", kind: "number", min: -10000, max: 10000 },
  { key: "hidden", label: "Hidden", kind: "bool" },
  { key: "hide_battery", label: "Hide battery", kind: "bool" },
  {
    key: "battery_entity",
    label: "Battery sensor (auto if empty)",
    kind: "entity",
    domain: "sensor",
    when: (p) => !p.hide_battery,
  },
];

const isMode = (...modes: string[]) => (p: EntityProfile) => modes.includes(p.mode ?? "snapshot");

export const DOMAINS: Record<string, DomainDefinition> = {
  camera: {
    title: "Cameras",
    fields: [
      {
        key: "mode",
        label: "Mode",
        kind: "select",
        options: ["live", "snapshot", "placeholder"],
        optionLabels: { live: "Live video", snapshot: "Snapshots", placeholder: "Placeholder" },
      },
      {
        key: "interval",
        label: "Snapshot interval (s)",
        kind: "number",
        min: 1,
        max: 3600,
        when: (p) => isMode("snapshot")(p) || (isMode("live")(p) && p.fallback !== "placeholder"),
      },
      {
        key: "fallback",
        label: "If live fails",
        kind: "select",
        options: ["snapshot", "placeholder", "none"],
        optionLabels: { snapshot: "Show snapshots", placeholder: "Show placeholder", none: "Show nothing" },
        when: isMode("live"),
      },
      {
        key: "placeholder_text",
        label: "Placeholder text",
        kind: "text",
        when: (p) => isMode("placeholder")(p) || p.fallback === "placeholder",
      },
      {
        key: "placeholder_url",
        label: "Placeholder link",
        kind: "url",
        when: (p) => isMode("placeholder")(p) || p.fallback === "placeholder",
      },
      { key: "motion_entity", label: "Motion sensor", kind: "entity", domain: "binary_sensor" },
    ],
    pickTile: (p) =>
      p.mode === "live" ? "camera-live" : p.mode === "placeholder" ? "placeholder" : "camera-snapshot",
    summary: (p) => [
      p.mode === "live" ? "Live video" : p.mode === "placeholder" ? "Placeholder" : `Snapshots every ${p.interval ?? 5} s`,
      ...(p.motion_entity ? ["Motion"] : []),
    ],
  },
  cover: {
    title: "Blinds",
    fields: [{ key: "hide_tilt", label: "Hide tilt", kind: "bool" }],
    pickTile: () => "cover",
    summary: (p) => (p.hide_tilt ? ["Tilt hidden"] : []),
    groupControl: CoverGroupControl,
    sectionControl: BlindModeControl,
    settingsSection: ScheduleEditor,
  },
};

export function tileTypeFor(tile: ResolvedTile): string {
  if (tile.profile.tile && TILES[tile.profile.tile]) return tile.profile.tile;
  return DOMAINS[tile.domain]?.pickTile(tile.profile) ?? "placeholder";
}

export function tileDefinitionFor(tile: ResolvedTile): TileDefinition {
  return TILES[tileTypeFor(tile)] ?? TILES.placeholder;
}
