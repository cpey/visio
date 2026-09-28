import { describe, expect, it } from "vitest";
import { PULL_THRESHOLD, pullDistance, shouldRefresh } from "./pull";

describe("pullDistance", () => {
  it("ignores upward movement", () => {
    expect(pullDistance(-40)).toBe(0);
  });
  it("damps and caps the pull", () => {
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(1000)).toBe(110);
  });
});

describe("shouldRefresh", () => {
  it("triggers only past the threshold", () => {
    expect(shouldRefresh(PULL_THRESHOLD - 1)).toBe(false);
    expect(shouldRefresh(PULL_THRESHOLD)).toBe(true);
  });
});
