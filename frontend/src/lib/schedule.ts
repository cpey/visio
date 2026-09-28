// Mirrors custom_components/visio/schedule.py for display ("next action") only;
// the schedule itself runs inside Home Assistant.

import { DAYS, type BlindsConfig } from "../types";

export interface NextAction {
  action: "open" | "close";
  time: string;
  /** 0 = today, 1 = tomorrow, … */
  daysAhead: number;
  day: (typeof DAYS)[number];
}

/** JS getDay() (0 = Sunday) → our index (0 = Monday). */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The next enabled schedule action strictly after `now` (within a week), in automatic mode. */
export function nextAction(blinds: BlindsConfig | undefined, now: Date): NextAction | null {
  if (!blinds || blinds.mode !== "auto") return null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = mondayIndex(now);
  for (let ahead = 0; ahead <= 7; ahead++) {
    const day = DAYS[(today + ahead) % 7];
    const candidates: NextAction[] = [];
    for (const sched of blinds.schedules) {
      if (sched.enabled === false || !sched.entities?.length) continue;
      const times = sched.days?.[day];
      for (const action of ["open", "close"] as const) {
        const time = times?.[action];
        if (!time) continue;
        const [h, m] = time.split(":").map(Number);
        if (ahead === 0 && h * 60 + m <= nowMinutes) continue;
        candidates.push({ action, time, daysAhead: ahead, day });
      }
    }
    if (candidates.length) return candidates.sort((a, b) => a.time.localeCompare(b.time))[0];
  }
  return null;
}

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export function describeNext(next: NextAction): string {
  const when = next.daysAhead === 0 ? "" : next.daysAhead === 1 ? " tomorrow" : ` ${DAY_NAMES[next.day]}`;
  return `Next: ${next.action} at ${next.time}${when}`;
}
