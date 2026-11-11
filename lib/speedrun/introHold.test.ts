import { describe, expect, it, vi } from "vitest";
import { holdIntro, registerIntroHold } from "./introHold";

const fake = (currentTime: number, endTime: number) =>
  ({ currentTime, effect: { getComputedTiming: () => ({ endTime }) }, pause: vi.fn(), play: vi.fn(), finish: vi.fn() }) as unknown as Animation & { play: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };

describe("holdIntro", () => {
  // Catches: resume rewinding an animation that had already ended (a veil that replays from the start).
  it("finishes animations that are past their end and plays the rest", () => {
    const ended = fake(900, 800);
    const running = fake(300, 800);
    registerIntroHold([ended, running]);
    expect(holdIntro(null)).toBe(true);
    expect(ended.finish).toHaveBeenCalled();
    expect(ended.play).not.toHaveBeenCalled();
    expect(running.play).toHaveBeenCalled();
    expect(running.finish).not.toHaveBeenCalled();
  });

  it("pauses and seeks every animation", () => {
    const a = fake(0, 800);
    registerIntroHold([a]);
    holdIntro(250);
    expect(a.pause).toHaveBeenCalled();
    expect(a.currentTime).toBe(250);
  });

  // Catches: the hold re-applying fills after the intro is done.
  it("reports no intro once the registration is released", () => {
    const release = registerIntroHold([fake(0, 1)]);
    release();
    expect(holdIntro(100)).toBe(false);
  });
});
