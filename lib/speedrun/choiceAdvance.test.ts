import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChoiceAdvance } from "./choiceAdvance";

describe("the choice advance", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances once, after the delay", () => {
    const advance = vi.fn();
    const choice = createChoiceAdvance(advance, 260);
    choice.schedule();
    vi.advanceTimersByTime(259);
    expect(advance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("restarts the timer on a second answer: one advance, 260ms after the last", () => {
    const advance = vi.fn();
    const choice = createChoiceAdvance(advance, 260);
    choice.schedule();
    vi.advanceTimersByTime(100);
    choice.schedule();
    vi.advanceTimersByTime(259);
    expect(advance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(advance).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("never advances after a cancel", () => {
    const advance = vi.fn();
    const choice = createChoiceAdvance(advance, 260);
    choice.schedule();
    vi.advanceTimersByTime(100);
    choice.cancel();
    vi.advanceTimersByTime(1000);
    expect(advance).not.toHaveBeenCalled();
  });

  it("can schedule again after an advance or a cancel", () => {
    const advance = vi.fn();
    const choice = createChoiceAdvance(advance, 260);
    choice.schedule();
    vi.advanceTimersByTime(260);
    choice.schedule();
    choice.cancel();
    choice.schedule();
    vi.advanceTimersByTime(260);
    expect(advance).toHaveBeenCalledTimes(2);
  });
});
