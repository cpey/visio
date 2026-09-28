import type { Hass, UpdatesStatus } from "../types";

/** Admin only. */
export function getUpdatesStatus(hass: Hass): Promise<UpdatesStatus> {
  return hass.callWS<UpdatesStatus>({ type: "visio/updates/status" });
}

/** Admin only. Starts the run in Home Assistant and returns immediately. */
export function runUpdates(hass: Hass, entityIds?: string[]): Promise<{ started: boolean }> {
  return hass.callWS({ type: "visio/updates/run", ...(entityIds ? { entity_ids: entityIds } : {}) });
}
