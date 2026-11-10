import { describe, expect, it } from "vitest";
import { introCues, introEndMs, pressableAtMs } from "./heroIntro";
import { MOTION } from "./motion";

const counts = { words: 3, paragraphs: 2 };
const cue = (cues: ReturnType<typeof introCues>, target: string, index = 0) =>
  cues.find((c) => c.target === target && c.index === index);

describe("introCues", () => {
  const cues = introCues(MOTION, counts);

  it("staggers the words", () => {
    expect([0, 1, 2].map((i) => cue(cues, "word", i)?.atMs)).toEqual([0, 120, 240]);
    expect(cues.filter((c) => c.target === "word").every((c) => c.durationMs === 420)).toBe(true);
  });

  it("places the later fades, the flight and the links", () => {
    expect(cue(cues, "second")?.atMs).toBe(700);
    expect(cue(cues, "subtitle")?.atMs).toBe(1100);
    expect(cue(cues, "flight")).toMatchObject({ atMs: 1500, durationMs: 520 });
    expect(cue(cues, "links")).toMatchObject({ atMs: 2020, durationMs: 1100 });
    expect([0, 1].map((i) => cue(cues, "paragraph", i)?.atMs)).toEqual([2300, 2450]);
    expect(cue(cues, "close")?.atMs).toBe(3000);
  });

  it("ends at 3420 and is pressable at 3000", () => {
    expect(introEndMs(cues)).toBe(3420);
    expect(pressableAtMs(cues)).toBe(3000);
  });

  it("is sorted, with close last", () => {
    for (let i = 1; i < cues.length; i++) expect(cues[i].atMs).toBeGreaterThanOrEqual(cues[i - 1].atMs);
    expect(Math.max(...cues.map((c) => c.atMs))).toBe(cue(cues, "close")?.atMs);
  });

  it("puts every word at 0 with no stagger", () => {
    const flat = introCues({ ...MOTION, introWordStaggerMs: 0 }, counts);
    expect(flat.filter((c) => c.target === "word").map((c) => c.atMs)).toEqual([0, 0, 0]);
  });
});
