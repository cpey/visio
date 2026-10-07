import type { BackupsStatus, Hass } from "../types";

/** Admin only. Home Assistant's backup schedule and the state of the copy disk. */
export function getBackupsStatus(hass: Hass): Promise<BackupsStatus> {
  return hass.callWS<BackupsStatus>({ type: "visio/backups/status" });
}
