import { useEffect, useState } from "react";
import { getVersion, setBlindMode } from "../api/config";
import { useNow } from "../lib/hooks";
import { describeNext, nextAction } from "../lib/schedule";
import type { BlindMode } from "../types";
import type { SectionControlProps } from "./types";

const MODES: { id: BlindMode; label: string }[] = [
  { id: "auto", label: "Automatic" },
  { id: "manual", label: "Manual" },
];

/** Blinds section header: Automatic (schedules run) / Manual, plus the next scheduled action. */
export function BlindModeControl({ hass, config, onConfig }: SectionControlProps) {
  const now = useNow(30000);
  const [error, setError] = useState<string | null>(null);
  // Dev builds (development VM) never run schedules, whatever the mode says.
  const [devBuild, setDevBuild] = useState(false);
  useEffect(() => {
    getVersion(hass).then((v) => setDevBuild(!!v?.includes("-dev")));
  }, []);
  const blinds = config.blinds ?? { mode: "manual", schedules: [] };
  if (!blinds.schedules.length) return null; // nothing to automate yet

  const next = nextAction(blinds, new Date(now));
  const change = async (mode: BlindMode) => {
    if (mode === blinds.mode) return;
    setError(null);
    try {
      onConfig(await setBlindMode(hass, mode));
    } catch (err) {
      setError((err as Error)?.message ?? "Could not change mode");
    }
  };

  return (
    <div className="mode-control">
      <span className="mode-control__hint">
        {error
          ? `⚠ ${error}`
          : blinds.mode === "manual"
            ? "Schedules paused"
            : devBuild
              ? "Development build: schedules don't run"
              : next
                ? describeNext(next)
                : "No upcoming action"}
      </span>
      <div className="segmented segmented--compact" role="radiogroup" aria-label="Blinds mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={blinds.mode === m.id}
            className={`segmented__option${blinds.mode === m.id ? " segmented__option--active" : ""}`}
            onClick={() => change(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
