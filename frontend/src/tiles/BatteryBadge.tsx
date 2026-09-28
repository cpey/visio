import { batteryLevel } from "../lib/battery";
import type { Hass } from "../types";

const LOW = 20;

/** Small battery indicator; renders nothing without a known level. */
export function BatteryBadge({ hass, entityId }: { hass: Hass; entityId?: string }) {
  const level = entityId ? batteryLevel(hass.states[entityId]) : null;
  if (level === null) return null;
  return (
    <span className={`battery${level <= LOW ? " battery--low" : ""}`} title={`Battery ${level}%`}>
      <svg viewBox="0 0 24 12" aria-hidden="true">
        <rect x="0.5" y="0.5" width="20" height="11" rx="2" fill="none" stroke="currentColor" />
        <rect x="21" y="3.5" width="2.5" height="5" rx="1" fill="currentColor" />
        <rect x="2" y="2" width={Math.max(1, (17 * level) / 100)} height="8" rx="1" fill="currentColor" />
      </svg>
      {level}%
    </span>
  );
}
