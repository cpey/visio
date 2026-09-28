import { useEffect, useRef, useState } from "react";
import { callService } from "../api/services";
import { runSequentially } from "../lib/sequence";
import type { GroupControlProps } from "./types";

const SET_POSITION = 4;
const SEND_DELAY_MS = 400;
/** Pause between per-blind commands so the hub treats each as a separate task. */
const COMMAND_GAP_MS = 300;

/** Open, close or position several covers, one command per cover. */
export function CoverGroupControl({ hass, entityIds }: GroupControlProps) {
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

  const run = async (service: string, ids: string[], data?: Record<string, unknown>) => {
    setError(null);
    setBusy(true);
    const failed = await runSequentially(
      ids,
      (id) => callService(hass, "cover", service, id, data),
      COMMAND_GAP_MS,
    );
    setBusy(false);
    if (failed.length) {
      const names = failed.map((id) => hass.states[id]?.attributes.friendly_name ?? id);
      setError(`failed: ${names.join(", ")}`);
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
    <div className={`group-control${none ? " group-control--idle" : ""}`}>
      <span className="group-control__count">
        {none ? "Select blinds to control them together" : `${entityIds.length} selected${busy ? " · sending…" : ""}`}
        {error ? ` · ⚠ ${error}` : ""}
      </span>
      <div className="control__buttons">
        <button className="btn" disabled={none || busy} onClick={() => run("open_cover", entityIds)}>
          Open all
        </button>
        <button className="btn" disabled={none || busy} onClick={() => run("close_cover", entityIds)}>
          Close all
        </button>
      </div>
      {/* Slider kept even when nothing is selected, so the bar keeps its size. */}
      <label className="control__slider">
        <span>Position</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={shown}
          disabled={positionable.length === 0}
          onChange={(e) => onSlide(Number(e.target.value))}
        />
        <span className="control__value">{shown}%</span>
      </label>
    </div>
  );
}
