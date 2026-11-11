import { MOTION, type Motion } from "./motion";

type Range = { min: number; max: number; step: number };

const ms = (max: number, step = 10): Range => ({ min: 0, max, step });
const px = (max: number): Range => ({ min: 0, max, step: 1 });

// Slider bounds for the dev-only motion panel, in MOTION's key order.
export const TUNING_RANGES: Record<keyof Motion, Range> = {
  coverMs: { min: 120, max: 1200, step: 10 },
  holdMs: ms(600),
  revealMs: { min: 120, max: 1400, step: 10 },
  bandVw: { min: 0, max: 60, step: 1 },
  fadeOutMs: ms(800),
  fadeInMs: ms(800),
  cascadeMs: ms(1000),
  cascadeStaggerMs: ms(200, 5),
  cardInMs: ms(800),
  cardInPx: px(48),
  phaseExitMs: ms(800),
  phaseExitPx: px(48),
  stepMs: ms(900),
  stepPx: px(48),
  choiceAdvanceMs: ms(800),
  progressMs: ms(1200),
  submittingMs: ms(2000, 50),
  chipSweepMs: ms(800),
  introWordStaggerMs: ms(240),
  introWordMs: ms(840),
  introRisePx: px(48),
  introSecondAtMs: ms(1400),
  introSubtitleAtMs: ms(2200),
  introSubtitleWordStaggerMs: ms(120, 5),
  introSpotlightFlashMs: ms(1200),
  introSpotlightDimMs: ms(800),
  introSpotlightHoldMs: ms(2000),
  introSpotlightVeilOpacity: { min: 0.5, max: 1, step: 0.01 },
  introSpotlightPadPx: px(80),
  introFlightMs: ms(1040),
  introParagraphsAfterLandMs: ms(1000),
  introParagraphStaggerMs: ms(300),
  introCloseAfterLandMs: ms(2000),
  introLinksMs: ms(2200),
};

export const TUNING_PRESETS: { name: string; values: Motion }[] = [
  { name: "Approved sweep", values: { ...MOTION } },
  {
    name: "Snappy",
    values: { ...MOTION, coverMs: 360, holdMs: 80, revealMs: 420, cascadeStaggerMs: 40, stepMs: 280, cardInMs: 260 },
  },
];

export function motionJson(values: Motion): string {
  const flat = Object.fromEntries((Object.keys(MOTION) as (keyof Motion)[]).map((key) => [key, values[key]]));
  return JSON.stringify(flat, null, 2);
}
