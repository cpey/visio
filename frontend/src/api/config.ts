import type { BlindMode, Hass, VisioConfig } from "../types";

/** Installed Visio version, e.g. "0.3.0" or "0.2.0-dev+ab4b01a" (dev deploy). */
export async function getVersion(hass: Hass): Promise<string | null> {
  try {
    return (await hass.callWS<{ version: string }>({ type: "visio/info" })).version;
  } catch {
    return null;
  }
}

/** Any logged-in user may switch blinds between automatic schedules and manual. */
export function setBlindMode(hass: Hass, mode: BlindMode): Promise<VisioConfig> {
  return hass.callWS<VisioConfig>({ type: "visio/blinds/mode", mode });
}

export function getConfig(hass: Hass): Promise<VisioConfig> {
  return hass.callWS<VisioConfig>({ type: "visio/config/get" });
}

/** Admin only; the server validates and returns the stored config. */
export function setConfig(hass: Hass, config: VisioConfig): Promise<VisioConfig> {
  return hass.callWS<VisioConfig>({ type: "visio/config/set", config });
}
