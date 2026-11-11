import { describe, expect, it } from "vitest";
import { beatOffsets, introCues, introEndMs, pressableAtMs } from "./heroIntro";
import { MOTION } from "./motion";

const counts = { words: 3, subtitleWords: 13, paragraphs: 2 };
const cue = (cues: ReturnType<typeof introCues>, target: string, index = 0) =>
  cues.find((c) => c.target === target && c.index === index);

describe("introCues", () => {
  const cues = introCues(MOTION, counts);

  it("staggers the headline words", () => {
    expect([0, 1, 2].map((i) => cue(cues, "word", i)?.atMs)).toEqual([0, 120, 240]);
    expect(cues.filter((c) => c.target === "word").every((c) => c.durationMs === 420)).toBe(true);
  });

  it("brings the subtitle in word by word", () => {
    const words = cues.filter((c) => c.target === "subtitle");
    expect(words).toHaveLength(13);
    expect(words.map((c) => c.atMs)).toEqual(Array.from({ length: 13 }, (_, i) => 1100 + i * 35));
    expect(words.every((c) => c.durationMs === 420)).toBe(true);
    expect(cue(cues, "second")?.atMs).toBe(700);
  });

  it("flashes when the last word has landed, then dims, holds and flies", () => {
    expect(cue(cues, "flash")).toMatchObject({ atMs: 1940, durationMs: 450 });
    expect(cue(cues, "veil")).toMatchObject({ atMs: 2390, durationMs: 300 });
    expect(cue(cues, "flight")).toMatchObject({ atMs: 3390, durationMs: 520 });
    expect(cue(cues, "unveil")).toMatchObject({ atMs: 3390, durationMs: 520 });
  });

  it("holds the veil for the hold, between the dim and the flight", () => {
    const veil = cue(cues, "veil")!;
    expect(cue(cues, "flight")!.atMs - (veil.atMs + veil.durationMs)).toBe(MOTION.introSpotlightHoldMs);
  });

  it("keeps the links, paragraphs and close as offsets from the landing", () => {
    const landing = cue(cues, "flight")!.atMs + cue(cues, "flight")!.durationMs;
    expect(cue(cues, "links")).toMatchObject({ atMs: landing, durationMs: 1100 });
    expect([0, 1].map((i) => cue(cues, "paragraph", i)?.atMs)).toEqual([landing + 280, landing + 430]);
    expect(cue(cues, "close")?.atMs).toBe(landing + 980);
  });

  it("moves everything after the beat when the hold changes", () => {
    const longer = introCues({ ...MOTION, introSpotlightHoldMs: MOTION.introSpotlightHoldMs + 500 }, counts);
    for (const target of ["flight", "links", "close"]) expect(cue(longer, target)!.atMs - cue(cues, target)!.atMs).toBe(500);
    expect(cue(longer, "veil")!.atMs).toBe(cue(cues, "veil")!.atMs);
  });

  it("ends at 5310 and is pressable at 4890", () => {
    expect(introEndMs(cues)).toBe(5310);
    expect(pressableAtMs(cues)).toBe(4890);
  });

  it("is sorted, with close last", () => {
    for (let i = 1; i < cues.length; i++) expect(cues[i].atMs).toBeGreaterThanOrEqual(cues[i - 1].atMs);
    expect(Math.max(...cues.map((c) => c.atMs))).toBe(cue(cues, "close")?.atMs);
  });

  it("puts every word at 0 with no stagger", () => {
    const flat = introCues({ ...MOTION, introWordStaggerMs: 0 }, counts);
    expect(flat.filter((c) => c.target === "word").map((c) => c.atMs)).toEqual([0, 0, 0]);
  });

  it("starts the flash at the subtitle's end whatever the stagger", () => {
    const flat = introCues({ ...MOTION, introSubtitleWordStaggerMs: 0 }, counts);
    expect(cue(flat, "flash")!.atMs).toBe(MOTION.introSubtitleAtMs + MOTION.introWordMs);
  });

  it("places the veil's hold and fade-out inside its one animation", () => {
    const offsets = beatOffsets(cue(cues, "veil")!, cue(cues, "unveil")!)!;
    expect(offsets.totalMs).toBe(1520);
    expect(offsets.settled).toBeCloseTo(300 / 1520);
    expect(offsets.held).toBeCloseTo(1000 / 1520);
  });

  // Catches: NaN keyframe offsets (a thrown animate() call) when the tuning panel zeroes the beat.
  it("has no beat when the dim, hold and flight are all zero", () => {
    const flat = introCues({ ...MOTION, introSpotlightDimMs: 0, introSpotlightHoldMs: 0, introFlightMs: 0 }, counts);
    expect(beatOffsets(cue(flat, "veil")!, cue(flat, "unveil")!)).toBeNull();
  });

  it("keeps the offsets ordered with a zero dim or a zero flight", () => {
    const noDim = introCues({ ...MOTION, introSpotlightDimMs: 0 }, counts);
    const a = beatOffsets(cue(noDim, "veil")!, cue(noDim, "unveil")!)!;
    expect(a.settled).toBe(0);
    expect(a.held).toBeLessThanOrEqual(1);
    const noFlight = introCues({ ...MOTION, introFlightMs: 0 }, counts);
    const b = beatOffsets(cue(noFlight, "veil")!, cue(noFlight, "unveil")!)!;
    expect(b.settled).toBeLessThanOrEqual(b.held);
    expect(b.held).toBe(1);
  });
});
