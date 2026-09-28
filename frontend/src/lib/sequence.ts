/**
 * Run `fn` for each id one after another, pausing `gapMs` between calls.
 * Some hubs drop simultaneous commands (e.g. Norman derives the task id from the
 * current millisecond, so parallel commands collide). Returns the ids that failed.
 */
export async function runSequentially(
  ids: string[],
  fn: (id: string) => Promise<unknown>,
  gapMs: number,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<string[]> {
  const failed: string[] = [];
  for (const [i, id] of ids.entries()) {
    if (i > 0) await sleep(gapMs);
    try {
      await fn(id);
    } catch {
      failed.push(id);
    }
  }
  return failed;
}
