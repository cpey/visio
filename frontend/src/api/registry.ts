import type { Hass } from "../types";

interface DisplayEntry {
  ei: string; // entity_id
  di?: string; // device_id
}

/** entity_id → device_id, from HA's display registry (available to non-admin users). */
export async function fetchEntityDevices(hass: Hass): Promise<Map<string, string>> {
  try {
    const result = await hass.callWS<{ entities: DisplayEntry[] }>({
      type: "config/entity_registry/list_for_display",
    });
    return new Map(result.entities.filter((e) => e.di).map((e) => [e.ei, e.di!]));
  } catch {
    return new Map();
  }
}
