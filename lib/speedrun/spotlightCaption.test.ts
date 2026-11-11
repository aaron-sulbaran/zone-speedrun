import { describe, expect, it } from "vitest";
import { captionLeft, phoneCaptionMaxWidth } from "./spotlightCaption";

// The pre-Ruling-31 formula, kept here verbatim so desktop is pinned to it.
const oldLeft = (wordsLeft: number, wordsWidth: number, width: number, vw: number) =>
  Math.min(Math.max(wordsLeft + wordsWidth / 2 - width / 2, 16), Math.max(16, vw - 16 - width));

describe("phone caption", () => {
  for (const vw of [320, 375, 390]) {
    it(`starts at the paragraph's left and stays inside the gutters at ${vw}`, () => {
      const paragraph = { left: 24, width: vw - 48 };
      const maxWidth = phoneCaptionMaxWidth(paragraph, vw);
      for (const captionWidth of [maxWidth, maxWidth * 0.6, 120]) {
        const left = captionLeft({ words: { left: 30, width: 150 }, paragraph, captionWidth, viewportWidth: vw, phone: true });
        expect(left).toBe(24);
        expect(left).toBeGreaterThanOrEqual(16);
        expect(left + captionWidth).toBeLessThanOrEqual(vw - 16);
      }
    });
  }
  it("caps the width at 22rem on a wide paragraph", () => {
    expect(phoneCaptionMaxWidth({ left: 24, width: 700 }, 844)).toBe(352);
  });
  it("falls back to centring when there is no paragraph", () => {
    expect(captionLeft({ words: { left: 100, width: 200 }, paragraph: null, captionWidth: 100, viewportWidth: 390, phone: true })).toBe(oldLeft(100, 200, 100, 390));
  });
});

describe("desktop caption", () => {
  it("centres under the words", () => {
    const left = captionLeft({ words: { left: 500, width: 300 }, paragraph: { left: 400, width: 600 }, captionWidth: 200, viewportWidth: 1440, phone: false });
    expect(left).toBe(oldLeft(500, 300, 200, 1440));
    expect(left).toBe(550);
  });
  it("clamps to the left and right gutters", () => {
    for (const [wl, ww, cw, vw] of [[0, 40, 300, 1440], [1400, 40, 300, 1440], [10, 100, 400, 500]]) {
      expect(captionLeft({ words: { left: wl, width: ww }, paragraph: { left: 24, width: 300 }, captionWidth: cw, viewportWidth: vw, phone: false })).toBe(oldLeft(wl, ww, cw, vw));
    }
  });
});
