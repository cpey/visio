import { useEffect, useRef, useState } from "react";
import { type BlindCommand, type BlindsStatus, getBlindsStatus, moveBlinds } from "../api/blinds";
import { reconnect } from "../api/reconnect";
import type { GroupControlProps } from "./types";

const SET_POSITION = 4;
const SEND_DELAY_MS = 400;
/** How often to refresh the queue status while blinds are moving or being checked. */
const STATUS_POLL_MS = 5000;

/**
 * The one control for blinds: position slider plus Fully open / Fully close,
 * applied to the selected blinds (tap cards to select). Commands go through Visio's
 * queue in Home Assistant: one blind at a time, checked and resent if dropped.
 */
export function CoverGroupControl({ hass, entityIds, allIds, selectAll }: GroupControlProps) {
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectTried, setReconnectTried] = useState(false);
  const [queue, setQueue] = useState<BlindsStatus>({ pending: [], not_responding: {} });

  const unresponsive = allIds.filter((id) => !hass.states[id] || hass.states[id].state === "unavailable");
  // Forget a previous attempt once everything responds again.
  useEffect(() => {
    if (unresponsive.length === 0) setReconnectTried(false);
  }, [unresponsive.length]);

  const doReconnect = async (ids: string[]) => {
    setReconnecting(true);
    try {
      await reconnect(hass, ids);
      // A blind that "didn't move" gets a fresh chance; its next command clears it server-side too.
      setQueue((q) => ({ ...q, not_responding: {} }));
    } catch {
      // The notice below explains what to check if it's still down.
    } finally {
      // Give the integration a moment to fetch the blinds' status again.
      setTimeout(() => {
        setReconnecting(false);
        setReconnectTried(true);
      }, 8000);
    }
  };
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Queue status: on open, then every few seconds while blinds are moving or being checked.
  const loadQueue = () => getBlindsStatus(hass).then(setQueue).catch(() => {});
  useEffect(() => {
    loadQueue();
  }, []);
  const checking = queue.pending.length > 0;
  useEffect(() => {
    if (!checking) return;
    const id = setInterval(loadQueue, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [checking]);
  const nameOf = (id: string) => hass.states[id]?.attributes.friendly_name ?? id;
  const didntMove = Object.keys(queue.not_responding).filter((id) => allIds.includes(id));

  const positionable = entityIds.filter(
    (id) => Number(hass.states[id]?.attributes.supported_features ?? 0) & SET_POSITION,
  );
  // Slider starts at the selection's average position.
  const current = positionable.map((id) => Number(hass.states[id]?.attributes.current_position ?? 0));
  const average = current.length ? Math.round(current.reduce((a, b) => a + b, 0) / current.length / 5) * 5 : 0;
  const shown = position ?? average;
  const none = entityIds.length === 0;
  const names = entityIds.map(nameOf);

  const run = async (command: BlindCommand, ids: string[], position?: number) => {
    setError(null);
    setBusy(true);
    try {
      setQueue(await moveBlinds(hass, ids, command, position));
    } catch (err) {
      setError((err as Error)?.message ?? "couldn't send the command");
    } finally {
      setBusy(false);
    }
  };

  const onSlide = (value: number) => {
    setPosition(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      run("set_position", positionable, value);
      setPosition(null);
    }, SEND_DELAY_MS);
  };

  return (
    <div className={`blind-panel${none ? " blind-panel--idle" : ""}`}>
      {unresponsive.length > 0 && (
        <div className="blind-panel__down" role="alert">
          <span>
            <strong>
              {unresponsive.length === allIds.length
                ? "Blinds aren't responding"
                : `${unresponsive.map((id) => hass.states[id]?.attributes.friendly_name ?? id).join(", ")} ${unresponsive.length === 1 ? "isn't" : "aren't"} responding`}
            </strong>
            <br />
            {reconnecting
              ? "Reconnecting…"
              : reconnectTried
                ? "Still not responding. Check that the blinds hub has power and is connected to the network."
                : "Home Assistant lost the connection to the blinds hub."}
          </span>
          <button className="btn" onClick={() => doReconnect(unresponsive)} disabled={reconnecting}>
            {reconnecting ? "Reconnecting…" : "Reconnect"}
          </button>
        </div>
      )}
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
          {busy || entityIds.some((id) => queue.pending.includes(id)) ? " · moving…" : ""}
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
        <button className="btn" disabled={none || busy} onClick={() => run("open", entityIds)}>
          Fully open
        </button>
        <button className="btn" disabled={none || busy} onClick={() => run("close", entityIds)}>
          Fully close
        </button>
      </div>
      {error && <p className="blind-panel__error">⚠ {error}</p>}
      {didntMove.length > 0 && unresponsive.length === 0 && (
        <div className="blind-panel__down" role="alert">
          <span>
            <strong>
              {didntMove.map(nameOf).join(", ")} didn't move
            </strong>
            <br />
            Visio sent the command twice. If it keeps happening, reconnect the blinds hub.
          </span>
          <button className="btn" onClick={() => doReconnect(didntMove)} disabled={reconnecting}>
            {reconnecting ? "Reconnecting…" : "Reconnect"}
          </button>
        </div>
      )}
    </div>
  );
}
