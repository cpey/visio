import type { Hass } from "../types";

/** Call a Home Assistant service on one or more entities (non-admin users may do this). */
export function callService(
  hass: Hass,
  domain: string,
  service: string,
  entityId: string | string[],
  data: Record<string, unknown> = {},
): Promise<unknown> {
  return hass.callWS({
    type: "call_service",
    domain,
    service,
    target: { entity_id: entityId },
    service_data: data,
  });
}
