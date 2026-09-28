import { describe, expect, it } from "vitest";
import type { BlindsConfig } from "../types";
import { describeNext, mondayIndex, nextAction } from "./schedule";

// 2026-09-28 is a Monday.
const at = (day: number, hh: number, mm: number) => new Date(2026, 8, 28 + day, hh, mm);

const blinds: BlindsConfig = {
  mode: "auto",
  schedules: [
    {
      id: "all",
      enabled: true,
      entities: ["cover.a"],
      days: { mon: { open: "07:30", close: "21:00" }, wed: { open: "08:00" } },
    },
  ],
};

describe("mondayIndex", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(mondayIndex(at(0, 12, 0))).toBe(0);
    expect(mondayIndex(at(6, 12, 0))).toBe(6);
  });
});

describe("nextAction", () => {
  it("finds the next action later today", () => {
    expect(nextAction(blinds, at(0, 8, 0))).toMatchObject({ action: "close", time: "21:00", daysAhead: 0 });
  });
  it("skips the current minute and rolls to later days", () => {
    expect(nextAction(blinds, at(0, 21, 0))).toMatchObject({ action: "open", time: "08:00", daysAhead: 2 });
  });
  it("wraps around the week", () => {
    expect(nextAction(blinds, at(3, 9, 0))).toMatchObject({ day: "mon", daysAhead: 4 });
  });
  it("is null in manual mode, when disabled, or without blinds", () => {
    expect(nextAction({ ...blinds, mode: "manual" }, at(0, 8, 0))).toBeNull();
    expect(nextAction({ mode: "auto", schedules: [{ ...blinds.schedules[0], enabled: false }] }, at(0, 8, 0))).toBeNull();
    expect(nextAction({ mode: "auto", schedules: [{ ...blinds.schedules[0], entities: [] }] }, at(0, 8, 0))).toBeNull();
  });
});

describe("describeNext", () => {
  it("phrases today, tomorrow and later days", () => {
    expect(describeNext({ action: "close", time: "21:00", daysAhead: 0, day: "mon" })).toBe("Next: close at 21:00");
    expect(describeNext({ action: "open", time: "07:30", daysAhead: 1, day: "tue" })).toBe("Next: open at 07:30 tomorrow");
    expect(describeNext({ action: "open", time: "08:00", daysAhead: 2, day: "wed" })).toBe("Next: open at 08:00 Wednesday");
  });
});
