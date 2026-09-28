import { useEffect, useRef, useState } from "react";
import { startWebRtc, supportsWebRtc, type LiveSession } from "../api/camera";
import { usePageVisible } from "../lib/hooks";
import { nextDelayMs } from "../lib/timing";
import { PlaceholderTile } from "./PlaceholderTile";
import { SnapshotTile } from "./SnapshotTile";
import { TileFrame } from "./TileFrame";
import type { TileProps } from "./types";

const RETRY_BASE_S = 30;
/** Reconnect delay after a session that was playing ends (e.g. provider session limit). */
const RECONNECT_MS = 2000;
/** Give up on a session that negotiated but delivered no frames (e.g. unreachable media path). */
const FIRST_FRAME_TIMEOUT_MS = 15000;

/**
 * WebRTC live view. While the stream is down (unsupported, failed, or dropped
 * by the provider, e.g. Ring's time-limited sessions) it renders the profile's
 * fallback and retries with backoff.
 */
export function LiveTile(props: TileProps) {
  const { hass, tile } = props;
  const visible = usePageVisible();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hassRef = useRef(hass);
  hassRef.current = hass;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let failures = 0;
    let session: LiveSession | null = null;
    let playing = false;
    let retry: ReturnType<typeof setTimeout>;
    let firstFrameTimer: ReturnType<typeof setTimeout>;
    const video = videoRef.current;

    // Only frames on screen count as live: a negotiated session can still be black.
    const onFirstFrame = () => {
      if (cancelled || playing || !video || video.videoWidth === 0) return;
      clearTimeout(firstFrameTimer);
      failures = 0;
      playing = true;
      setLive(true);
      setError(null);
    };
    video?.addEventListener("loadeddata", onFirstFrame);
    video?.addEventListener("resize", onFirstFrame);

    const onFailure = (reason: string) => {
      if (cancelled) return;
      clearTimeout(firstFrameTimer);
      session?.close();
      session = null;
      setLive(false);
      setError(reason);
      if (playing) {
        // A working stream ended: reconnect straight away.
        playing = false;
        retry = setTimeout(connect, RECONNECT_MS);
        return;
      }
      failures++;
      retry = setTimeout(connect, nextDelayMs(RETRY_BASE_S, failures - 1));
    };

    const connect = async () => {
      if (cancelled) return;
      try {
        if (!(await supportsWebRtc(hassRef.current, tile.entityId))) {
          onFailure("live view not supported");
          return;
        }
        firstFrameTimer = setTimeout(() => onFailure("no video received"), FIRST_FRAME_TIMEOUT_MS);
        session = await startWebRtc(
          hassRef.current,
          tile.entityId,
          (stream) => {
            if (cancelled || !video) return;
            if (video.srcObject !== stream) video.srcObject = stream;
          },
          onFailure,
        );
        if (cancelled) session.close();
      } catch (err) {
        onFailure(err instanceof Error ? err.message : String(err));
      }
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearTimeout(firstFrameTimer);
      video?.removeEventListener("loadeddata", onFirstFrame);
      video?.removeEventListener("resize", onFirstFrame);
      session?.close();
      setLive(false);
    };
  }, [tile.entityId, visible]);

  const fallback = tile.profile.fallback ?? "snapshot";
  return (
    <>
      <div className={live ? "live-host" : "live-host live-host--hidden"}>
        <TileFrame hass={hass} tile={tile} status={<span className="badge badge--live">LIVE</span>}>
          <video ref={videoRef} autoPlay muted playsInline />
        </TileFrame>
      </div>
      {!live &&
        (fallback === "snapshot" ? (
          <SnapshotTile {...props} />
        ) : fallback === "placeholder" ? (
          <PlaceholderTile {...props} />
        ) : (
          <TileFrame hass={hass} tile={tile} status={error ? `⚠ ${error}` : "Connecting…"}>
            <div className="tile__empty">Connecting…</div>
          </TileFrame>
        ))}
    </>
  );
}
