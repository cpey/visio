import { describe, expect, it } from "vitest";
import { formatAge, isStale, MAX_BACKOFF_S, nextDelayMs } from "./timing";

describe("nextDelayMs", () => {
  it("uses the interval when healthy", () => {
    expect(nextDelayMs(5, 0)).toBe(5000);
  });
  it("doubles per failure", () => {
    expect(nextDelayMs(5, 1)).toBe(10000);
    expect(nextDelayMs(5, 3)).toBe(40000);
  });
  it("caps the backoff", () => {
    expect(nextDelayMs(5, 20)).toBe(MAX_BACKOFF_S * 1000);
  });
  it("never drops below the configured interval", () => {
    expect(nextDelayMs(600, 2)).toBe(600000);
  });
  it("clamps nonsense intervals to 1 s", () => {
    expect(nextDelayMs(0, 0)).toBe(1000);
  });
});

describe("isStale", () => {
  it("is false before the first image", () => {
    expect(isStale(null, 100000, 5)).toBe(false);
  });
  it("uses 30 s minimum for short intervals", () => {
    expect(isStale(0, 29000, 5)).toBe(false);
    expect(isStale(0, 31000, 5)).toBe(true);
  });
  it("uses 3 intervals for long intervals", () => {
    expect(isStale(0, 170000, 60)).toBe(false);
    expect(isStale(0, 181000, 60)).toBe(true);
  });
});

describe("formatAge", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatAge(null, 0)).toBe("—");
    expect(formatAge(0, 4000)).toBe("4s ago");
    expect(formatAge(0, 125000)).toBe("2m ago");
    expect(formatAge(0, 7200000)).toBe("2h ago");
  });
});
