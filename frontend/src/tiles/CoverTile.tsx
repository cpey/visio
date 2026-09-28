import { useEffect, useRef, useState } from "react";
import { callService } from "../api/services";
import { BatteryBadge } from "./BatteryBadge";
import type { TileProps } from "./types";

// HA CoverEntityFeature bits
const OPEN = 1;
const CLOSE = 2;
const SET_POSITION = 4;
const STOP = 8;
const OPEN_TILT = 16;
const CLOSE_TILT = 32;
const SET_TILT_POSITION = 128;

const SEND_DELAY_MS = 400;

/** Slider that follows HA state, but sends only after the user stops moving it. */
function useCommittedSlider(remote: number | undefined, send: (value: number) => void) {
  const [local, setLocal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Drop the local override once HA reports the new value.
  useEffect(() => setLocal(null), [remote]);

  const onChange = (value: number) => {
    setLocal(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => send(value), SEND_DELAY_MS);
  };
  return [local ?? remote ?? 0, onChange] as const;
}

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

/** Blinds, shutters and curtains (HA `cover` entities). */
export function CoverTile({ hass, tile }: TileProps) {
  const entity = hass.states[tile.entityId];
  const rawFeatures = Number(entity?.attributes.supported_features ?? 0);
  const features = tile.profile.hide_tilt ? rawFeatures & ~(OPEN_TILT | CLOSE_TILT | SET_TILT_POSITION) : rawFeatures;
  const position = entity?.attributes.current_position as number | undefined;
  const tilt = entity?.attributes.current_tilt_position as number | undefined;
  const unavailable = !entity || entity.state === "unavailable";
  const [error, setError] = useState<string | null>(null);

  const run = (service: string, data?: Record<string, unknown>) => {
    setError(null);
    callService(hass, "cover", service, tile.entityId, data).catch((err) =>
      setError(err?.message ?? "Command failed"),
    );
  };

  const [pos, setPos] = useCommittedSlider(position, (v) => run("set_cover_position", { position: v }));
  const [tiltPos, setTiltPos] = useCommittedSlider(tilt, (v) =>
    run("set_cover_tilt_position", { tilt_position: v }),
  );

  return (
    <div className={`tile tile--control${unavailable ? " tile--unavailable" : ""}`}>
      <div className="control__head">
        <BlindGraphic
          position={position}
          moving={entity?.state === "opening" || entity?.state === "closing"}
        />
        <span className="tile__name">{tile.name}</span>
        <BatteryBadge hass={hass} entityId={tile.battery} />
        <span className="tile__status">{error ? `⚠ ${error}` : describe(entity?.state ?? "unknown", position)}</span>
      </div>

      <div className="control__buttons">
        {features & OPEN ? (
          <button className="btn" disabled={unavailable} onClick={() => run("open_cover")}>
            Open
          </button>
        ) : null}
        {features & STOP ? (
          <button className="btn btn--ghost" disabled={unavailable} onClick={() => run("stop_cover")}>
            Stop
          </button>
        ) : null}
        {features & CLOSE ? (
          <button className="btn" disabled={unavailable} onClick={() => run("close_cover")}>
            Close
          </button>
        ) : null}
      </div>

      {features & SET_POSITION ? (
        <label className="control__slider">
          <span>Position</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pos}
            disabled={unavailable}
            onChange={(e) => setPos(Number(e.target.value))}
          />
          <span className="control__value">{pos}%</span>
        </label>
      ) : null}

      {features & SET_TILT_POSITION ? (
        <label className="control__slider">
          <span>Tilt</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={tiltPos}
            disabled={unavailable}
            onChange={(e) => setTiltPos(Number(e.target.value))}
          />
          <span className="control__value">{tiltPos}%</span>
        </label>
      ) : features & (OPEN_TILT | CLOSE_TILT) ? (
        <div className="control__buttons">
          <button className="btn btn--ghost" disabled={unavailable} onClick={() => run("open_cover_tilt")}>
            Tilt open
          </button>
          <button className="btn btn--ghost" disabled={unavailable} onClick={() => run("close_cover_tilt")}>
            Tilt closed
          </button>
        </div>
      ) : null}
    </div>
  );
}
