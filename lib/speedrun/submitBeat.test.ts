import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmitBeat } from "./submitBeat";

describe("the submit beat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("never runs when cancelled before the delay", () => {
    const run = vi.fn();
    const beat = createSubmitBeat();
    beat.begin(run, 700);
    expect(beat.isActive()).toBe(true);
    vi.advanceTimersByTime(699);
    beat.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
    expect(beat.isActive()).toBe(false);
  });

  it("runs once when the delay passes, and stays active until it is cancelled", () => {
    const run = vi.fn();
    const beat = createSubmitBeat();
    beat.begin(run, 700);
    vi.advanceTimersByTime(700);
    vi.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(beat.isActive()).toBe(true);
  });

  it("a failure after it fired (cancel) leaves it inactive", () => {
    const beat = createSubmitBeat();
    beat.begin(() => undefined, 700);
    vi.advanceTimersByTime(700);
    beat.cancel();
    expect(beat.isActive()).toBe(false);
  });

  it("a second begin replaces the first", () => {
    const first = vi.fn();
    const second = vi.fn();
    const beat = createSubmitBeat();
    beat.begin(first, 700);
    beat.begin(second, 700);
    vi.advanceTimersByTime(700);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
