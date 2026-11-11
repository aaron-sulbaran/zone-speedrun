import type { Motion } from "./motion";

export type IntroTarget = "word" | "second" | "subtitle" | "flash" | "veil" | "flight" | "unveil" | "links" | "paragraph" | "close";
export type IntroCue = { target: IntroTarget; index: number; atMs: number; durationMs: number };

const ORDER: IntroTarget[] = ["word", "second", "subtitle", "flash", "veil", "flight", "unveil", "links", "paragraph", "close"];

/**
 * The hero intro as a flat schedule; the component plays it, so the timing stays testable.
 * The beat (flash, veil, hold) follows the last subtitle word; the flight starts when the hold ends,
 * and the links, paragraphs and close are offsets from the landing, so tuning the beat moves them all.
 */
export function introCues(m: Motion, counts: { words: number; subtitleWords: number; paragraphs: number }): IntroCue[] {
  const fade = (target: IntroTarget, index: number, atMs: number): IntroCue => ({
    target,
    index,
    atMs,
    durationMs: m.introWordMs,
  });
  const subtitleEndMs = m.introSubtitleAtMs + Math.max(0, counts.subtitleWords - 1) * m.introSubtitleWordStaggerMs + m.introWordMs;
  const veilAtMs = subtitleEndMs + m.introSpotlightFlashMs;
  const flightAtMs = veilAtMs + m.introSpotlightDimMs + m.introSpotlightHoldMs;
  const landAtMs = flightAtMs + m.introFlightMs;
  const cues: IntroCue[] = [
    ...Array.from({ length: counts.words }, (_, i) => fade("word", i, i * m.introWordStaggerMs)),
    fade("second", 0, m.introSecondAtMs),
    ...Array.from({ length: counts.subtitleWords }, (_, i) => fade("subtitle", i, m.introSubtitleAtMs + i * m.introSubtitleWordStaggerMs)),
    { target: "flash", index: 0, atMs: subtitleEndMs, durationMs: m.introSpotlightFlashMs },
    { target: "veil", index: 0, atMs: veilAtMs, durationMs: m.introSpotlightDimMs },
    { target: "flight", index: 0, atMs: flightAtMs, durationMs: m.introFlightMs },
    { target: "unveil", index: 0, atMs: flightAtMs, durationMs: m.introFlightMs },
    { target: "links", index: 0, atMs: landAtMs, durationMs: m.introLinksMs },
    ...Array.from({ length: counts.paragraphs }, (_, i) =>
      fade("paragraph", i, landAtMs + m.introParagraphsAfterLandMs + i * m.introParagraphStaggerMs),
    ),
    fade("close", 0, landAtMs + m.introCloseAfterLandMs),
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

/**
 * Where the veil's hold and fade-out sit inside its one animation (as fractions of its length), or null
 * when the beat has no length (a tuning panel can zero the dim, hold and flight together). The caption
 * leaves earlier: it starts fading `captionOutMs` before the flight and is gone as the flight starts.
 */
export function beatOffsets(veil: IntroCue, unveil: IntroCue, captionOutMs = 0): { totalMs: number; settled: number; held: number; captionFrom: number } | null {
  const totalMs = unveil.atMs + unveil.durationMs - veil.atMs;
  if (!(totalMs > 0)) return null;
  const settled = veil.durationMs / totalMs;
  const held = (unveil.atMs - veil.atMs) / totalMs;
  return { totalMs, settled, held, captionFrom: Math.min(held, Math.max(settled, held - captionOutMs / totalMs)) };
}
