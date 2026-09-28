// Merge discovered HA entities with stored profiles into the tiles to render.

import type { EntityProfile, HassEntity, Layout, VisioConfig } from "../types";
import { findBatteryEntity } from "./battery";

/** Domains discovered automatically, in grid section order. */
export const DISCOVERED_DOMAINS = ["camera", "cover"];

export const CAMERA_DEFAULTS: Required<Pick<EntityProfile, "mode" | "interval" | "fallback">> = {
  mode: "snapshot",
  interval: 5,
  fallback: "snapshot",
};

/** HA CameraEntityFeature.STREAM */
const CAMERA_FEATURE_STREAM = 2;

export interface ResolvedTile {
  entityId: string;
  domain: string;
  name: string;
  profile: EntityProfile;
  /** Battery sensor for the tile (profile override, else same device). */
  battery?: string;
}

export function domainOf(entityId: string): string {
  return entityId.split(".", 1)[0];
}

/**
 * Profile with defaults applied. Cameras that can stream default to live view
 * (some, e.g. Ring without a subscription, have no still images at all);
 * the rest default to snapshots. Stored profile values always win.
 */
export function withDefaults(
  entityId: string,
  profile: EntityProfile | undefined,
  entity?: HassEntity,
): EntityProfile {
  if (domainOf(entityId) !== "camera") return { ...profile };
  const features = Number(entity?.attributes.supported_features ?? 0);
  const mode = features & CAMERA_FEATURE_STREAM ? "live" : CAMERA_DEFAULTS.mode;
  return { ...CAMERA_DEFAULTS, mode, ...profile };
}

export function discoverEntities(states: Record<string, HassEntity>): string[] {
  return Object.keys(states).filter((id) => DISCOVERED_DOMAINS.includes(domainOf(id)));
}

export function pickLayout(config: VisioConfig, requested: string | null): [string, Layout] {
  if (requested && config.layouts[requested]) return [requested, config.layouts[requested]];
  const [first] = Object.entries(config.layouts);
  return first ?? ["default", { columns: 3 }];
}

/** Tiles for a layout: explicit entity list if the layout has one, otherwise all visible entities. */
export function resolveTiles(
  states: Record<string, HassEntity>,
  config: VisioConfig,
  layout: Layout,
  includeHidden = false,
  deviceOf: Map<string, string> = new Map(),
): ResolvedTile[] {
  const ids = layout.entities?.length
    ? layout.entities.filter((id) => id in states)
    : discoverEntities(states);

  const tiles = ids
    .map((entityId, index) => {
      const profile = withDefaults(entityId, config.entities[entityId], states[entityId]);
      return {
        entityId,
        domain: domainOf(entityId),
        name: profile.name || states[entityId]?.attributes.friendly_name || entityId,
        profile,
        battery: profile.hide_battery
          ? undefined
          : (profile.battery_entity ?? findBatteryEntity(entityId, states, deviceOf)),
        index,
      };
    })
    .filter((t) => includeHidden || layout.entities?.length || !t.profile.hidden);

  // Explicit layout lists keep their order; otherwise sort by domain, profile order, then name.
  if (!layout.entities?.length) {
    const domainRank = (d: string) => DISCOVERED_DOMAINS.indexOf(d);
    tiles.sort(
      (a, b) =>
        domainRank(a.domain) - domainRank(b.domain) ||
        (a.profile.order ?? 0) - (b.profile.order ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }
  return tiles.map(({ index: _index, ...t }) => t);
}

/** Discovered entities that a layout with an explicit list does not include. */
export function missingFromLayout(states: Record<string, HassEntity>, layout: Layout): string[] {
  if (!layout.entities?.length) return [];
  return discoverEntities(states).filter((id) => !layout.entities!.includes(id));
}
