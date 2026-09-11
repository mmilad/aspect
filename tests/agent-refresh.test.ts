import { afterEach, expect, it, vi } from "vitest";
import { MissingRunError, RefreshLoop } from "../apps/web/components/assistant/refresh-loop";

afterEach(() => vi.useRealTimers());

it("does not poll idle history; explicit refresh loads once more", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue(false);
  const loop = new RefreshLoop(load, vi.fn());
  loop.refresh();
  await vi.advanceTimersByTimeAsync(30000);
  expect(load).toHaveBeenCalledTimes(1);
  loop.refresh();
  await vi.advanceTimersByTimeAsync(30000);
  expect(load).toHaveBeenCalledTimes(2);
  loop.dispose();
});

it("refreshes active work every two seconds and stops at terminal status", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
  const loop = new RefreshLoop(load, vi.fn());
  loop.refresh();
  await vi.advanceTimersByTimeAsync(20000);
  expect(load).toHaveBeenCalledTimes(3);
  loop.dispose();
});

it.each([new Error("network"), new MissingRunError("missing")])("bounds retry failures", async error => {
  vi.useFakeTimers();
  const load = vi.fn().mockRejectedValue(error);
  const loop = new RefreshLoop(load, vi.fn());
  loop.refresh();
  await vi.advanceTimersByTimeAsync(30000);
  expect(load).toHaveBeenCalledTimes(error instanceof MissingRunError ? 1 : 3);
  loop.dispose();
});

it("aborts obsolete loads and prevents their completion from scheduling requests", async () => {
  vi.useFakeTimers();
  let finish!: (active: boolean) => void;
  let signal!: AbortSignal;
  const load = vi.fn((input: AbortSignal) => { signal = input; return new Promise<boolean>(resolve => { finish = resolve; }); });
  const loop = new RefreshLoop(load, vi.fn());
  loop.refresh();
  loop.dispose();
  expect(signal.aborted).toBe(true);
  finish(true);
  await vi.advanceTimersByTimeAsync(30000);
  expect(load).toHaveBeenCalledTimes(1);
});
