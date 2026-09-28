import { DAYS, type BlindSchedule, type BlindsConfig, type Day, type DayTimes } from "../types";
import type { SettingsSectionProps } from "./types";

const DAY_LABELS: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const WEEKDAYS: Day[] = ["mon", "tue", "wed", "thu", "fri"];

const EMPTY: BlindsConfig = { mode: "manual", schedules: [] };

/** Settings → Blinds: Automatic/Manual and Monday–Sunday open/close schedules (run by Home Assistant). */
export function ScheduleEditor({ hass, draft, setDraft, entityIds }: SettingsSectionProps) {
  const blinds = draft.blinds ?? EMPTY;
  const name = (id: string) =>
    draft.entities[id]?.name || hass.states[id]?.attributes.friendly_name || id;

  const setBlinds = (update: (b: BlindsConfig) => BlindsConfig) =>
    setDraft((d) => ({ ...d, blinds: update(d.blinds ?? EMPTY) }));

  const setSchedule = (index: number, update: (s: BlindSchedule) => BlindSchedule) =>
    setBlinds((b) => ({ ...b, schedules: b.schedules.map((s, i) => (i === index ? update(s) : s)) }));

  const setTime = (index: number, day: Day, key: keyof DayTimes, value: string) =>
    setSchedule(index, (s) => {
      const days = { ...s.days };
      const times: DayTimes = { ...days[day], [key]: value || undefined };
      if (!times.open) delete times.open;
      if (!times.close) delete times.close;
      if (times.open || times.close) days[day] = times;
      else delete days[day];
      return { ...s, days };
    });

  const copyMonday = (index: number, targets: Day[]) =>
    setSchedule(index, (s) => {
      const monday = s.days?.mon;
      const days = { ...s.days };
      for (const day of targets) {
        if (monday) days[day] = { ...monday };
        else delete days[day];
      }
      return { ...s, days };
    });

  const addSchedule = () =>
    setBlinds((b) => {
      const n = b.schedules.length + 1;
      let id = `schedule-${n}`;
      while (b.schedules.some((s) => s.id === id)) id += "x";
      return {
        ...b,
        schedules: [
          ...b.schedules,
          { id, name: `Schedule ${n}`, enabled: true, entities: [...entityIds], days: {} },
        ],
      };
    });

  const removeSchedule = (index: number) =>
    setBlinds((b) => ({ ...b, schedules: b.schedules.filter((_, i) => i !== index) }));

  return (
    <section className="schedules">
      <div className="schedules__head">
        <div>
          <h2 className="schedules__title">Schedules</h2>
          <p className="hint">Home Assistant opens and closes the blinds at these times, even with no screen open.</p>
        </div>
        <div className="segmented segmented--compact" role="radiogroup" aria-label="Blinds mode">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={blinds.mode === m}
              className={`segmented__option${blinds.mode === m ? " segmented__option--active" : ""}`}
              onClick={() => setBlinds((b) => ({ ...b, mode: m }))}
            >
              {m === "auto" ? "Automatic" : "Manual"}
            </button>
          ))}
        </div>
      </div>
      {blinds.mode === "manual" && (
        <p className="schedules__paused">Manual mode: schedules are saved but won't run.</p>
      )}

      {blinds.schedules.map((sched, index) => (
        <div key={sched.id} className={`card schedule${sched.enabled === false ? " schedule--off" : ""}`}>
          <div className="schedule__top">
            <input
              className="schedule__name"
              value={sched.name ?? ""}
              placeholder="Schedule name"
              aria-label="Schedule name"
              onChange={(e) => setSchedule(index, (s) => ({ ...s, name: e.target.value || undefined }))}
            />
            <label className="schedule__enabled">
              <span>{sched.enabled === false ? "Off" : "On"}</span>
              <input
                type="checkbox"
                className="switch"
                checked={sched.enabled !== false}
                onChange={(e) => setSchedule(index, (s) => ({ ...s, enabled: e.target.checked }))}
              />
            </label>
            <button className="btn btn--ghost" onClick={() => removeSchedule(index)}>
              Remove
            </button>
          </div>

          <div className="schedule__blinds">
            {entityIds.map((id) => {
              const on = sched.entities?.includes(id) ?? false;
              return (
                <button
                  key={id}
                  className={`chip${on ? " chip--on" : ""}`}
                  aria-pressed={on}
                  onClick={() =>
                    setSchedule(index, (s) => {
                      const current = s.entities ?? [];
                      return { ...s, entities: on ? current.filter((x) => x !== id) : [...current, id] };
                    })
                  }
                >
                  {name(id)}
                </button>
              );
            })}
          </div>

          <div className="week" role="table" aria-label="Weekly times">
            <div className="week__row week__row--head" role="row">
              <span role="columnheader" />
              <span role="columnheader">Open</span>
              <span role="columnheader">Close</span>
            </div>
            {DAYS.map((day) => (
              <div key={day} className="week__row" role="row">
                <span className="week__day" role="rowheader" title={DAY_LABELS[day]}>
                  <span className="week__day--long">{DAY_LABELS[day]}</span>
                  <span className="week__day--short">{DAY_LABELS[day].slice(0, 3)}</span>
                </span>
                {(["open", "close"] as const).map((key) => (
                  <input
                    key={key}
                    type="time"
                    className="week__time"
                    aria-label={`${DAY_LABELS[day]} ${key}`}
                    value={sched.days?.[day]?.[key] ?? ""}
                    onChange={(e) => setTime(index, day, key, e.target.value)}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="schedule__shortcuts">
            <button className="btn btn--ghost" onClick={() => copyMonday(index, WEEKDAYS.slice(1))}>
              Copy Monday to weekdays
            </button>
            <button className="btn btn--ghost" onClick={() => copyMonday(index, DAYS.slice(1))}>
              Copy Monday to every day
            </button>
          </div>
          <p className="hint">Leave a time empty to skip that action on that day.</p>
        </div>
      ))}

      <button className="btn btn--ghost" onClick={addSchedule}>
        Add schedule
      </button>
    </section>
  );
}
