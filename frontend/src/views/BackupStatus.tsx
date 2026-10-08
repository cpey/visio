import { useEffect, useState } from "react";
import { getBackupsStatus } from "../api/backups";
import type { BackupsStatus, Day, Hass } from "../types";

const SHORT_DAYS: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const LEVEL = {
  ok: { label: "Active", badge: "badge--ok" },
  warning: { label: "Needs attention", badge: "badge--warn" },
  off: { label: "Off", badge: "badge--stale" },
} as const;

interface Props {
  hass: Hass;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function schedule(s: BackupsStatus["schedule"]): string {
  const at = s.time ? ` at ${s.time}` : "";
  if (s.recurrence === "daily") return `Daily${at}`;
  if (s.recurrence === "custom_days") return `${(s.days ?? []).map((d) => SHORT_DAYS[d] ?? d).join(", ")}${at}`;
  if (s.recurrence === "never") return "Off";
  return "Unknown";
}

function keeps(s: BackupsStatus["schedule"]): string | null {
  if (s.keep_copies) return `keeps the last ${s.keep_copies}`;
  if (s.keep_days) return `keeps ${s.keep_days} days`;
  return null;
}

/** Settings → System → Backups: whether Home Assistant's automatic backups run, and where to. */
export function BackupStatus({ hass }: Props) {
  const [status, setStatus] = useState<BackupsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    getBackupsStatus(hass)
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((err) => setError((err as Error)?.message ?? "Could not load the backup status"));

  // On open; "Check again" refreshes after a backup.
  useEffect(() => {
    load();
  }, []);

  const level = status ? LEVEL[status.level] : null;
  const keep = status ? keeps(status.schedule) : null;

  return (
    <>
      <div className="schedules__head">
        <div>
          <h2 className="schedules__title">Backups</h2>
          <p className="hint">
            Home Assistant makes the backups (Settings → System → Backups in Home Assistant). This shows whether they're
            running and where they're saved.
          </p>
        </div>
        <div className="system__actions">
          {level && <span className={`badge ${level.badge}`}>{level.label}</span>}
          <button className="btn btn--ghost" onClick={load}>
            Check again
          </button>
        </div>
      </div>
      <div className="card">
        {error && <p className="schedules__paused">⚠ {error}</p>}
        {!status && !error && <p className="hint">Loading…</p>}
        {status && (
          <>
            {status.problems.map((p) => (
              <p key={p} className="schedules__paused">
                ⚠ {p}
              </p>
            ))}
            <dl className="backups__facts">
              <dt>Automatic</dt>
              <dd>
                {schedule(status.schedule)}
                {keep ? ` · ${keep}` : ""}
              </dd>
              <dt>Saved to</dt>
              <dd>{status.schedule.locations?.length ? status.schedule.locations.join(", ") : "—"}</dd>
              <dt>Last backup</dt>
              <dd>{when(status.last_success)}</dd>
              {status.last_attempt && status.last_attempt !== status.last_success && (
                <>
                  <dt>Last attempt</dt>
                  <dd>{when(status.last_attempt)}</dd>
                </>
              )}
              {status.next && (
                <>
                  <dt>Next</dt>
                  <dd>{when(status.next)}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </div>
    </>
  );
}
