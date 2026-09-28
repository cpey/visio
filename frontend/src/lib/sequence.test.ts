import { describe, expect, it } from "vitest";
import { runSequentially } from "./sequence";

describe("runSequentially", () => {
  it("calls one at a time, in order, with gaps between (not before the first)", async () => {
    const log: string[] = [];
    let active = 0;
    const fn = async (id: string) => {
      active++;
      expect(active).toBe(1); // never overlapping
      log.push(id);
      await Promise.resolve();
      active--;
    };
    const sleep = async (ms: number) => {
      log.push(`sleep ${ms}`);
    };
    await runSequentially(["a", "b", "c"], fn, 250, sleep);
    expect(log).toEqual(["a", "sleep 250", "b", "sleep 250", "c"]);
  });

  it("continues after a failure and reports failed ids", async () => {
    const done: string[] = [];
    const failed = await runSequentially(
      ["a", "b", "c"],
      async (id) => {
        if (id === "b") throw new Error("hub busy");
        done.push(id);
      },
      0,
      async () => undefined,
    );
    expect(done).toEqual(["a", "c"]);
    expect(failed).toEqual(["b"]);
  });
});
