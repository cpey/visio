import type { Hass, UpdatesStatus } from "../types";

/** Admin only. */
export function getUpdatesStatus(hass: Hass): Promise<UpdatesStatus> {
  return hass.callWS<UpdatesStatus>({ type: "visio/updates/status" });
}

/** Admin only. Asks Supervisor and HACS to look for new versions now; can take a minute. */
export function checkForUpdates(hass: Hass): Promise<UpdatesStatus & { errors: string[] }> {
  return hass.callWS({ type: "visio/updates/check" });
}

/** Admin only. Starts the run in Home Assistant and returns immediately. */
export function runUpdates(hass: Hass, entityIds?: string[]): Promise<{ started: boolean }> {
  return hass.callWS({ type: "visio/updates/run", ...(entityIds ? { entity_ids: entityIds } : {}) });
}
