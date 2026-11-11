import { describe, expect, it } from "vitest";
import { introSpanMs } from "./heroIntro";
import { FLASH_EASE, MOTION } from "./motion";
import { flashKeyframes } from "./spotlightFrames";

describe("flashKeyframes", () => {
  // Catches: the amplitude read from constants instead of the Motion keys, so the tuning panel cannot move it.
  it("takes its scale and opacity from the keys it is given", () => {
    const frames = flashKeyframes({ introSpotlightFlashScale: 1.2, introSpotlightFlashOpacity: 0.25 });
    expect(frames.map((f) => [f.transform, f.opacity])).toEqual([
      ["scale(1)", 1],
      ["scale(1.2)", 0.25],
      ["scale(1)", 1],
      ["scale(1.2)", 0.25],
      ["scale(1)", 1],
    ]);
  });

  // Catches: a pulse that does not return to rest, or one that eases linearly so the two pulses read as a snap.
  it("eases every pulse segment and ends at rest with nothing left over", () => {
    const frames = flashKeyframes(MOTION);
    expect(frames).toHaveLength(5);
    expect(frames.slice(0, 4).every((f) => f.easing === FLASH_EASE)).toBe(true);
    expect(frames[4]).toEqual({ transform: "scale(1)", opacity: 1 });
  });
});

describe("introSpanMs", () => {
  const counts = { words: 3, subtitleWords: 13, paragraphs: 2 };
  // Catches: a hold slider capped at a literal, so a longer tuned hold can no longer be reached.
  it("grows with the tuned hold, past the old 6000 ms cap", () => {
    expect(introSpanMs(MOTION, counts)).toBeLessThan(6000);
    expect(introSpanMs({ ...MOTION, introSpotlightHoldMs: 6000 }, counts)).toBeGreaterThan(6000);
  });
});
