import type { Hass } from "../types";

/** Reconnects (reloads) the integrations behind these blinds/cameras. Any logged-in user. */
export function reconnect(hass: Hass, entityIds: string[]): Promise<{ reloaded: string[]; errors: string[] }> {
  return hass.callWS({ type: "visio/reconnect", entity_ids: entityIds });
}
