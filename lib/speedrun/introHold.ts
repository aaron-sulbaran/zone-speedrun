// Dev only (the ?tune panel): holds the running hero intro at a chosen time so a frame can be judged
// by eye. The hook registers its animations here in development; production never calls it.
let current: Animation[] | null = null;

export function registerIntroHold(animations: Animation[]): () => void {
  current = animations;
  return () => {
    if (current === animations) current = null;
  };
}

/** Pauses every registered animation at `ms` into the intro, or resumes them from there for null. */
export function holdIntro(ms: number | null): boolean {
  if (!current) return false;
  for (const animation of current) {
    if (ms === null) animation.play();
    else {
      animation.pause();
      animation.currentTime = ms;
    }
  }
  return true;
}
