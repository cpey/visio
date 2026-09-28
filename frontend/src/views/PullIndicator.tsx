import type { CSSProperties } from "react";
import { PULL_THRESHOLD } from "../lib/pull";

/** Round spinner that follows the pull, then spins while refreshing. */
export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (!refreshing && pull === 0) return null;
  const offset = refreshing ? PULL_THRESHOLD * 0.6 : pull * 0.6;
  const progress = Math.min(pull / PULL_THRESHOLD, 1);
  return (
    <div
      className={`pull${refreshing ? " pull--refreshing" : ""}${progress >= 1 ? " pull--ready" : ""}`}
      style={{ transform: `translate(-50%, ${offset}px)`, opacity: refreshing ? 1 : 0.3 + 0.7 * progress }}
      aria-hidden="true"
    >
      <RefreshIcon style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }} />
    </div>
  );
}

export function RefreshIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" style={style} className="refresh-icon">
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
