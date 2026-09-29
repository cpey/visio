import { useEffect, useRef, useState } from "react";
import { callService } from "../api/services";
import { runSequentially } from "../lib/sequence";
import type { GroupControlProps } from "./types";

const SET_POSITION = 4;
const SEND_DELAY_MS = 400;
/** Pause between per-blind commands so the hub treats each as a separate task. */
const COMMAND_GAP_MS = 300;

/**
 * The one control for blinds: position slider plus Fully open / Fully close,
 * applied to the selected blinds (tap cards to select), one command per blind.
 */
export function CoverGroupControl({ hass, entityIds, selectAll }: GroupControlProps) {
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const positionable = entityIds.filter(
    (id) => Number(hass.states[id]?.attributes.supported_features ?? 0) & SET_POSITION,
  );
  // Slider starts at the selection's average position.
  const current = positionable.map((id) => Number(hass.states[id]?.attributes.current_position ?? 0));
  const average = current.length ? Math.round(current.reduce((a, b) => a + b, 0) / current.length / 5) * 5 : 0;
  const shown = position ?? average;
  const none = entityIds.length === 0;
  const names = entityIds.map((id) => hass.states[id]?.attributes.friendly_name ?? id);

  const run = async (service: string, ids: string[], data?: Record<string, unknown>) => {
    setError(null);
    setBusy(true);
    const failed = await runSequentially(ids, (id) => callService(hass, "cover", service, id, data), COMMAND_GAP_MS);
    setBusy(false);
    if (failed.length) {
      const failedNames = failed.map((id) => hass.states[id]?.attributes.friendly_name ?? id);
      setError(`couldn't move ${failedNames.join(", ")}`);
    }
  };

  const onSlide = (value: number) => {
    setPosition(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      run("set_cover_position", positionable, { position: value });
      setPosition(null);
    }, SEND_DELAY_MS);
  };

  return (
    <div className={`blind-panel${none ? " blind-panel--idle" : ""}`}>
      <div className="blind-panel__top">
        <label className="select-all">
          <input
            type="checkbox"
            checked={selectAll.checked}
            ref={(el) => {
              if (el) el.indeterminate = selectAll.indeterminate;
            }}
            onChange={(e) => selectAll.onChange(e.target.checked)}
          />
          Select all
        </label>
        <span className="blind-panel__selection">
          {none
            ? "Tap blinds below to select them"
            : entityIds.length <= 2
              ? names.join(" and ")
              : `${entityIds.length} blinds selected`}
          {busy ? " · moving…" : ""}
        </span>
      </div>

      <div className="blind-panel__slider">
        <span className="blind-panel__end">Closed</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={shown}
          disabled={positionable.length === 0 || busy}
          aria-label="Position of the selected blinds"
          onChange={(e) => onSlide(Number(e.target.value))}
        />
        <span className="blind-panel__end">Open</span>
        <span className="control__value">{none ? "—" : `${shown}%`}</span>
      </div>

      <div className="blind-panel__buttons">
        <button className="btn" disabled={none || busy} onClick={() => run("open_cover", entityIds)}>
          Fully open
        </button>
        <button className="btn" disabled={none || busy} onClick={() => run("close_cover", entityIds)}>
          Fully close
        </button>
      </div>
      {error && <p className="blind-panel__error">⚠ {error}</p>}
    </div>
  );
}
