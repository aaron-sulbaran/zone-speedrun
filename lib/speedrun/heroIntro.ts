import type { Motion } from "./motion";

export type IntroTarget = "word" | "second" | "subtitle" | "flight" | "links" | "paragraph" | "close";
export type IntroCue = { target: IntroTarget; index: number; atMs: number; durationMs: number };

const ORDER: IntroTarget[] = ["word", "second", "subtitle", "flight", "links", "paragraph", "close"];

/** The hero intro as a flat schedule; the component plays it, so the timing stays testable. */
export function introCues(m: Motion, counts: { words: number; paragraphs: number }): IntroCue[] {
  const fade = (target: IntroTarget, index: number, atMs: number): IntroCue => ({
    target,
    index,
    atMs,
    durationMs: m.introWordMs,
  });
  const cues: IntroCue[] = [
    ...Array.from({ length: counts.words }, (_, i) => fade("word", i, i * m.introWordStaggerMs)),
    fade("second", 0, m.introSecondAtMs),
    fade("subtitle", 0, m.introSubtitleAtMs),
    { target: "flight", index: 0, atMs: m.introFlightAtMs, durationMs: m.introFlightMs },
    { target: "links", index: 0, atMs: m.introFlightAtMs + m.introFlightMs, durationMs: m.introLinksMs },
    ...Array.from({ length: counts.paragraphs }, (_, i) =>
      fade("paragraph", i, m.introParagraphsAtMs + i * m.introParagraphStaggerMs),
    ),
    fade("close", 0, m.introCloseAtMs),
  ];
  return cues.sort((a, b) => a.atMs - b.atMs || ORDER.indexOf(a.target) - ORDER.indexOf(b.target) || a.index - b.index);
}

export function introEndMs(cues: IntroCue[]): number {
  return Math.max(0, ...cues.map((cue) => cue.atMs + cue.durationMs));
}

/** The close cue is the page's own button, so it is pressable the moment it starts. */
export function pressableAtMs(cues: IntroCue[]): number {
  return cues.find((cue) => cue.target === "close")?.atMs ?? introEndMs(cues);
}
