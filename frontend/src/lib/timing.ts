// Pure timing helpers for polling and reconnection (unit tested).

export const MAX_BACKOFF_S = 300;

/** Delay before the next snapshot fetch: the interval, doubled per consecutive failure. */
export function nextDelayMs(intervalS: number, failures: number): number {
  const base = Math.max(1, intervalS);
  const delay = failures > 0 ? Math.min(base * 2 ** failures, Math.max(base, MAX_BACKOFF_S)) : base;
  return delay * 1000;
}

/** An image is stale when it hasn't refreshed for 3 intervals (min 30 s). */
export function isStale(lastUpdatedMs: number | null, nowMs: number, intervalS: number): boolean {
  if (lastUpdatedMs === null) return false;
  return nowMs - lastUpdatedMs > Math.max(3 * intervalS, 30) * 1000;
}

export function formatAge(lastUpdatedMs: number | null, nowMs: number): string {
  if (lastUpdatedMs === null) return "—";
  const s = Math.max(0, Math.round((nowMs - lastUpdatedMs) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
