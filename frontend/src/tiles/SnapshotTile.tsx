import { useEffect, useRef, useState } from "react";
import { snapshotUrl } from "../api/camera";
import { usePageVisible, useNow } from "../lib/hooks";
import { formatAge, isStale, nextDelayMs } from "../lib/timing";
import { CAMERA_DEFAULTS } from "../lib/resolve";
import { TileFrame } from "./TileFrame";
import type { TileProps } from "./types";

/**
 * Polls the HA camera proxy; the new image replaces the old one only once loaded.
 * `note`: why a live tile fell back to snapshots, shown in the status line.
 */
export function SnapshotTile({ hass, tile, note }: TileProps & { note?: string }) {
  const interval = tile.profile.interval ?? CAMERA_DEFAULTS.interval;
  const visible = usePageVisible();
  const now = useNow();
  const [src, setSrc] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest hass without restarting the polling loop on every state change.
  const hassRef = useRef(hass);
  hassRef.current = hass;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!cancelled) timer = setTimeout(fetchOnce, nextDelayMs(interval, failures));
    };

    const fetchOnce = () => {
      const url = snapshotUrl(hassRef.current, tile.entityId, Date.now());
      if (!url) {
        failures++;
        setError("unavailable");
        schedule();
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        failures = 0;
        setSrc(url);
        setUpdatedAt(Date.now());
        setError(null);
        schedule();
      };
      img.onerror = () => {
        if (cancelled) return;
        failures++;
        setError("fetch failed");
        schedule();
      };
      img.src = url;
    };

    fetchOnce();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tile.entityId, interval, visible]);

  const stale = isStale(updatedAt, now, interval);
  return (
    <TileFrame
      hass={hass}
      tile={tile}
      stale={stale}
      status={
        <span title={note}>
          {note ? `⚠ ${note} · ` : ""}
          {error ? `⚠ ${error} · ${formatAge(updatedAt, now)}` : formatAge(updatedAt, now)}
        </span>
      }
    >
      {src ? <img src={src} alt={tile.name} /> : <div className="tile__empty">Loading…</div>}
    </TileFrame>
  );
}
