import type { Hass } from "../types";

export type BlindCommand = "open" | "close" | "set_position";

export interface BlindsStatus {
  /** Blinds waiting to be sent, or to be checked after moving. */
  pending: string[];
  /** entity_id → when it last failed to move (after one resend). */
  not_responding: Record<string, string>;
}

/**
 * Queue a command in Home Assistant (any household user). Visio sends blinds one at a
 * time, checks them once they should have arrived and resends to any that didn't move.
 */
export function moveBlinds(hass: Hass, entityIds: string[], command: BlindCommand, position?: number): Promise<BlindsStatus> {
  return hass.callWS<BlindsStatus>({
    type: "visio/blinds/move",
    entity_ids: entityIds,
    command,
    ...(position !== undefined ? { position } : {}),
  });
}

export function getBlindsStatus(hass: Hass): Promise<BlindsStatus> {
  return hass.callWS<BlindsStatus>({ type: "visio/blinds/status" });
}
