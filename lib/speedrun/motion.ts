// Act 2's one easing and its short durations, for Web Animations (CSS uses the
// `ease-sr` utility, which is the same curve).
export const SR_EASE = "cubic-bezier(.16,1,.3,1)";
export const SR_STEP_MS = 260;
export const SR_COUNT_MS = 1100;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
