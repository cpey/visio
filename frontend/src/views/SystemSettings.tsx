import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "../api/config";
import { BackupStatus } from "./BackupStatus";
import { checkForUpdates, getUpdatesStatus, runUpdates } from "../api/updates";
import { DAYS, type Day, type Hass, type UpdateItem, type UpdatesConfig, type UpdatesStatus, type VisioConfig } from "../types";

const DAY_LABELS: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DEFAULTS: UpdatesConfig = { mode: "manual", day: "sun", time: "04:00", backup: true };
const KIND: Record<UpdateItem["kind"], string> = { os: "System", core: "Home Assistant", other: "" };

interface Props {
  hass: Hass;
  draft: VisioConfig;
  setDraft(update: (draft: VisioConfig) => VisioConfig): void;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Settings → System: automatic updates (weekly or manual) and update-now, run inside Home Assistant. */
export function SystemSettings({ hass, draft, setDraft }: Props) {
  const updates = { ...DEFAULTS, ...draft.updates };
  const [status, setStatus] = useState<UpdatesStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A run that installs integrations/Core/OS restarts Home Assistant; while it's
  // unreachable we show "restarting" instead of an error and keep checking.
  const [restartExpected, setRestartExpected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkProblems, setCheckProblems] = useState<string[]>([]);
  // Refs mirror the flags so a load() scheduled earlier still sees the current values.
  const restartRef = useRef(false);
  const reconnectingRef = useRef(false);
  const runningRef = useRef(false);
  const versionRef = useRef<string | null>(null);
  const expectRestart = (on: boolean) => {
    restartRef.current = on;
    setRestartExpected(on);
  };
  const markReconnecting = (on: boolean) => {
    reconnectingRef.current = on;
    setReconnecting(on);
  };

  useEffect(() => {
    // Version of the code running in this page, captured once.
    getVersion(hass).then((v) => {
      versionRef.current = v;
      setLoadedVersion(v);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await getUpdatesStatus(hass);
      setStatus(next);
      runningRef.current = next.running;
      setError(null);
      if (reconnectingRef.current || restartRef.current) {
        // Back after a restart: check whether Visio itself changed.
        const running = await getVersion(hass);
        if (running && versionRef.current && running !== versionRef.current) setNewVersion(running);
        if (reconnectingRef.current && !next.running) expectRestart(false);
      }
      markReconnecting(false);
    } catch (err) {
      if (restartRef.current || runningRef.current) markReconnecting(true);
      else setError((err as Error)?.message ?? "Could not load updates");
    }
    // Stable: reads current values through refs; hass identity changes on every state update.
  }, []);

  // Refresh on open, and every 5 s while a run is in progress or HA is restarting.
  useEffect(() => {
    load();
    // Initial load only.
  }, []);
  const polling = !!status?.running || !!status?.items.some((i) => i.in_progress) || reconnecting || restartExpected;
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [polling, load]);

  const restartHa = async () => {
    if (!confirm("Restart Home Assistant now?\n\nCameras and blinds are unavailable for about a minute. This page reconnects by itself.")) return;
    expectRestart(true);
    try {
      await hass.callWS({ type: "call_service", domain: "homeassistant", service: "restart", service_data: {} });
    } catch {
      // The connection often drops before the reply arrives; the reconnect loop takes over.
    }
    markReconnecting(true);
  };

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await checkForUpdates(hass);
      setStatus(result);
      runningRef.current = result.running;
      setCheckProblems(result.errors ?? []);
    } catch (err) {
      setError((err as Error)?.message ?? "Could not check for updates");
    } finally {
      setChecking(false);
    }
  };

  const set = (patch: Partial<UpdatesConfig>) => setDraft((d) => ({ ...d, updates: { ...DEFAULTS, ...d.updates, ...patch } }));

  const start = async (entityIds?: string[]) => {
    const names = entityIds
      ? status?.items.filter((i) => entityIds.includes(i.entity_id)).map((i) => i.title).join(", ")
      : "all available updates";
    const chosen = (entityIds ?? available.map((i) => i.entity_id))
      .map((id) => status?.items.find((i) => i.entity_id === id))
      .filter((i): i is UpdateItem => !!i);
    // Core, OS and HACS integrations (incl. Visio) all end with a restart.
    const restarts = chosen.some((i) => i.kind !== "other" || i.platform === "hacs");
    const note = restarts
      ? "\n\nHome Assistant will restart afterwards (and the system reboots for an OS update). This page reconnects by itself."
      : "";
    if (!confirm(`Install ${names} now?${note}`)) return;
    try {
      await runUpdates(hass, entityIds);
      expectRestart(restarts);
      setTimeout(load, 1500);
    } catch (err) {
      setError((err as Error)?.message ?? "Could not start updates");
    }
  };

  const available = status?.items.filter((i) => i.available) ?? [];
  const busy = !!status?.running || available.some((i) => i.in_progress);

  return (
    <section className="rows system">
      <h2 className="schedules__title">Installed version</h2>
      <div className="card system__version">
        <span className="system__version-number">Visio {loadedVersion ?? "…"}</span>
        {loadedVersion?.includes("-dev") && <span className="badge badge--stale">dev build</span>}
        <span className="hint">
          {loadedVersion?.includes("-dev")
            ? "Development deploy (based on that release, plus the commit after “+”)."
            : "Installed from a GitHub release through HACS."}
        </span>
      </div>

      <h2 className="schedules__title">Home Assistant</h2>
      <div className="card system__version">
        <span className="hint system__restart-hint">
          Last resort if something stays stuck (for unresponsive blinds, use Reconnect in the Blinds view first).
          Restarts Home Assistant only; takes about a minute.
        </span>
        <button className="btn btn--ghost" onClick={restartHa} disabled={reconnecting || restartExpected}>
          {reconnecting || restartExpected ? "Restarting…" : "Restart Home Assistant"}
        </button>
      </div>

      <BackupStatus hass={hass} />

      <div className="schedules__head">
        <div>
          <h2 className="schedules__title">Automatic updates</h2>
          <p className="hint">
            Updates the system (Home Assistant OS), Home Assistant, add-ons and integrations, one at a time, with a
            backup first. Runs inside Home Assistant.
          </p>
        </div>
        <div className="segmented segmented--compact" role="radiogroup" aria-label="Update mode">
          {(["manual", "weekly"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={updates.mode === m}
              className={`segmented__option${updates.mode === m ? " segmented__option--active" : ""}`}
              onClick={() => set({ mode: m })}
            >
              {m === "manual" ? "Manual" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {updates.mode === "weekly" ? (
          <label className="field">
            <span className="field__label">Every</span>
            <span className="system__when">
              <select value={updates.day} onChange={(e) => set({ day: e.target.value as Day })}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABELS[d]}
                  </option>
                ))}
              </select>
              <span className="hint">at</span>
              <input type="time" value={updates.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
            </span>
          </label>
        ) : null}
        {updates.mode === "weekly" && loadedVersion?.includes("-dev") && (
          <p className="schedules__paused">Development build: scheduled updates don't run. Use “Update” below.</p>
        )}
        {updates.mode === "weekly" ? null : (
          <p className="hint">Manual: nothing updates on its own. Use “Update” below when you're ready.</p>
        )}
        <label className="field field--bool">
          <span className="field__label">Back up before updating</span>
          <input type="checkbox" className="switch" checked={updates.backup} onChange={(e) => set({ backup: e.target.checked })} />
        </label>
        <p className="hint">Save to apply the schedule and backup setting.</p>
      </div>

      <div className="schedules__head">
        <h2 className="schedules__title">Available updates</h2>
        <div className="system__actions">
          <button className="btn btn--ghost" onClick={check} disabled={busy || checking}>
            {checking ? "Checking…" : "Check for updates"}
          </button>
          <button className="btn" onClick={() => start()} disabled={busy || available.length === 0}>
            {busy ? "Updating…" : "Update all"}
          </button>
        </div>
      </div>
      {reconnecting && <p className="system__notice">Home Assistant is restarting… reconnecting</p>}
      {newVersion && (
        <p className="system__notice">
          Visio was updated to {newVersion}.{" "}
          <button className="btn" onClick={() => window.location.reload()}>
            Reload to use it
          </button>
        </p>
      )}
      {error && !reconnecting && <p className="schedules__paused">⚠ {error}</p>}
      {status?.pending && (
        <p className="schedules__paused">Waiting to continue after the restart: {status.pending.length} update(s).</p>
      )}
      {status?.last_check && (
        <p className="hint">
          Last checked {when(status.last_check)}
          {checking ? " · checking again (this can take a minute)…" : ""}
        </p>
      )}
      {checkProblems.length > 0 && (
        <p className="schedules__paused">Some sources couldn't be checked: {checkProblems.join("; ")}</p>
      )}
      {status && available.length === 0 && <p className="hint">Everything is up to date.</p>}
      {available.map((item) => (
        <div key={item.entity_id} className="row">
          <div className="row__head row__head--static">
            <span className="row__text">
              <span className="row__name">
                {item.title}
                {KIND[item.kind] && <span className="badge badge--stale system__kind">{KIND[item.kind]}</span>}
              </span>
              <span className="row__meta">
                {item.installed ?? "?"} → {item.latest ?? "?"}
                {item.in_progress ? " · installing…" : ""}
                {item.release_url && (
                  <>
                    {" · "}
                    <a href={item.release_url} target="_blank" rel="noopener noreferrer">
                      release notes
                    </a>
                  </>
                )}
              </span>
            </span>
            <button className="btn btn--ghost" disabled={busy} onClick={() => start([item.entity_id])}>
              Update
            </button>
          </div>
        </div>
      ))}

      {!!status?.history.length && (
        <>
          <h2 className="schedules__title">History</h2>
          {[...status.history].reverse().slice(0, 8).map((run) => (
            <div key={run.time} className="card system__run">
              <div className="card__title">
                <span>{run.run_open ? "In progress…" : run.summary}</span>
                <span className="hint">
                  {when(run.time)} · {run.trigger}
                </span>
              </div>
              {run.results.map((r) => (
                <div key={r.entity_id} className={`system__result${r.ok ? "" : r.started ? "" : " system__result--failed"}`}>
                  {r.started ? "⏳" : r.ok ? "✓" : "⚠"} {r.title}: {r.from ?? "?"} → {r.to ?? "?"}
                  {r.error ? ` (${r.error})` : ""}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
