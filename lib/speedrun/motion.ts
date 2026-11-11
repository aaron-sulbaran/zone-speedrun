import { getMotionOverrides } from "./tuning";

// Act 2's one easing and its durations, for Web Animations (CSS uses the
// `ease-sr` utility, which is the same curve). Every motion value lives here.
export const SR_EASE = "cubic-bezier(.16,1,.3,1)";
export const STEP_EASE = "cubic-bezier(.22,.61,.36,1)";
export const CARD_EASE = "cubic-bezier(.4,0,.2,1)";
export const COVER_EASE = "cubic-bezier(.7,0,.84,0)";
export const CHIP_EASE = "cubic-bezier(.2,.7,.3,1)";
// The 84 spotlight's curves: the words' pulses ease in and out on their own, the veil and caption ease in from nothing
// and the caption leaves on an accelerating curve so it is gone as the flight starts.
export const FLASH_EASE = "ease-in-out";
export const SPOTLIGHT_IN_EASE = "ease-out";
export const CAPTION_OUT_EASE = "ease-in";
export const SR_STEP_MS = 260;
export const SR_COUNT_MS = 1100;

export type Motion = {
  coverMs: number;
  holdMs: number;
  revealMs: number;
  lineDelayMs: number;
  lineFadeMs: number;
  lineHoldMs: number;
  bandVw: number;
  fadeOutMs: number;
  fadeInMs: number;
  cascadeMs: number;
  cascadeStaggerMs: number;
  cardInMs: number;
  cardInPx: number;
  phaseExitMs: number;
  phaseExitPx: number;
  stepMs: number;
  stepPx: number;
  choiceAdvanceMs: number;
  progressMs: number;
  submittingMs: number;
  chipSweepMs: number;
  introWordStaggerMs: number;
  introWordMs: number;
  introRisePx: number;
  introSecondAtMs: number;
  introSubtitleAtMs: number;
  introSubtitleWordStaggerMs: number;
  introSpotlightFlashMs: number;
  introSpotlightDimMs: number;
  introSpotlightHoldMs: number;
  introSpotlightCaptionOutMs: number;
  introSpotlightVeilOpacity: number;
  introSpotlightFlashScale: number;
  introSpotlightFlashOpacity: number;
  introFlightMs: number;
  introParagraphsAfterLandMs: number;
  introParagraphStaggerMs: number;
  introCloseAfterLandMs: number;
  introLinksMs: number;
};

export const MOTION: Motion = {
  coverMs: 480,
  holdMs: 370,
  revealMs: 560,
  lineDelayMs: 300,
  lineFadeMs: 252,
  lineHoldMs: 505,
  bandVw: 28,
  fadeOutMs: 240,
  fadeInMs: 180,
  cascadeMs: 420,
  cascadeStaggerMs: 60,
  cardInMs: 320,
  cardInPx: 14,
  phaseExitMs: 240,
  phaseExitPx: 14,
  stepMs: 360,
  stepPx: 14,
  choiceAdvanceMs: 260,
  progressMs: 480,
  submittingMs: 700,
  chipSweepMs: 320,
  introWordStaggerMs: 120,
  introWordMs: 420,
  introRisePx: 8,
  introSecondAtMs: 700,
  introSubtitleAtMs: 1100,
  introSubtitleWordStaggerMs: 35,
  introSpotlightFlashMs: 450,
  introSpotlightDimMs: 300,
  introSpotlightHoldMs: 700,
  introSpotlightCaptionOutMs: 200,
  introSpotlightVeilOpacity: 0.95,
  introSpotlightFlashScale: 1.06,
  introSpotlightFlashOpacity: 0.4,
  introFlightMs: 520,
  introParagraphsAfterLandMs: 280,
  introParagraphStaggerMs: 150,
  introCloseAfterLandMs: 980,
  introLinksMs: 1100,
};

export function motion(): Motion {
  return { ...MOTION, ...getMotionOverrides() };
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
