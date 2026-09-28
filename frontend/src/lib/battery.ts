import type { HassEntity } from "../types";

export function isBatterySensor(entity: HassEntity | undefined): boolean {
  return (
    !!entity &&
    entity.entity_id.startsWith("sensor.") &&
    entity.attributes.device_class === "battery"
  );
}

/**
 * The battery sensor for `entityId`: one on the same HA device, else one named
 * `sensor.<object_id>_battery` (e.g. YAML/REST sensors that have no device).
 */
export function findBatteryEntity(
  entityId: string,
  states: Record<string, HassEntity>,
  deviceOf: Map<string, string>,
): string | undefined {
  const device = deviceOf.get(entityId);
  if (device) {
    const sameDevice = Object.keys(states)
      .sort()
      .find((id) => deviceOf.get(id) === device && isBatterySensor(states[id]));
    if (sameDevice) return sameDevice;
  }
  const byName = `sensor.${entityId.split(".")[1]}_battery`;
  return isBatterySensor(states[byName]) ? byName : undefined;
}

/** Battery percentage from a sensor state, or null if unknown. */
export function batteryLevel(entity: HassEntity | undefined): number | null {
  const value = Number(entity?.state);
  return entity && Number.isFinite(value) ? Math.round(value) : null;
}
