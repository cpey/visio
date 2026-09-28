import type { ReactNode } from "react";
import { BatteryBadge } from "./BatteryBadge";
import type { Hass, ResolvedTileLike } from "./types";

interface Props {
  hass: Hass;
  tile: ResolvedTileLike;
  status?: ReactNode;
  stale?: boolean;
  children: ReactNode;
}

/** Common chrome for every tile: title, motion highlight and status line. */
export function TileFrame({ hass, tile, status, stale, children }: Props) {
  const motionId = tile.profile.motion_entity;
  const motion = motionId ? hass.states[motionId]?.state === "on" : false;
  return (
    <div className={`tile${motion ? " tile--motion" : ""}${stale ? " tile--stale" : ""}`}>
      <div className="tile__media">{children}</div>
      <div className="tile__bar">
        <span className="tile__name">{tile.name}</span>
        {motion && <span className="badge badge--motion">Motion</span>}
        {stale && <span className="badge badge--stale">Stale</span>}
        <BatteryBadge hass={hass} entityId={tile.battery} />
        <span className="tile__status">{status}</span>
      </div>
    </div>
  );
}
