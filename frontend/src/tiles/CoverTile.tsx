import { BatteryBadge } from "./BatteryBadge";
import type { TileProps } from "./types";

function describe(state: string, position: number | undefined): string {
  if (state === "opening" || state === "closing") return state[0].toUpperCase() + state.slice(1) + "…";
  if (state === "unavailable" || state === "unknown") return "Unavailable";
  if (position === undefined) return state === "open" ? "Open" : "Closed";
  if (position === 0) return "Closed";
  if (position === 100) return "Open";
  return `${position}% open`;
}

/** Window with the shade drawn down to the current position (100 = fully open). */
function BlindGraphic({ position, moving }: { position: number | undefined; moving: boolean }) {
  // A fully open blind still shows its rolled-up bar, so the icon never looks empty.
  const shade = Math.max(position === undefined ? 50 : 100 - position, 20);
  return (
    <span className={`blind-viz${moving ? " blind-viz--moving" : ""}`} aria-hidden="true">
      <span className="blind-viz__pane" />
      <span className="blind-viz__shade" style={{ height: `${shade}%` }} />
    </span>
  );
}

/**
 * A blind (HA `cover`) as a compact status card. Tapping it selects it; the
 * section's control panel (CoverGroupControl) moves the selected blinds.
 */
export function CoverTile({ hass, tile }: TileProps) {
  const entity = hass.states[tile.entityId];
  const position = entity?.attributes.current_position as number | undefined;
  const unavailable = !entity || entity.state === "unavailable";

  return (
    <div className={`tile tile--control tile--blind${unavailable ? " tile--unavailable" : ""}`}>
      <div className="control__head">
        <BlindGraphic position={position} moving={entity?.state === "opening" || entity?.state === "closing"} />
        <span className="tile__name">{tile.name}</span>
        <BatteryBadge hass={hass} entityId={tile.battery} />
      </div>
      <span className="blind__state">{describe(entity?.state ?? "unknown", position)}</span>
    </div>
  );
}
