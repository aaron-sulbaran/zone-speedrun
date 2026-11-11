// Dev only (the ?tune panel): holds the running hero intro at a chosen time so a frame can be judged
// by eye. The hook registers its animations here in development and lets go when the intro is done;
// production never calls it.
let current: Animation[] | null = null;

export function registerIntroHold(animations: Animation[]): () => void {
  current = animations;
  return () => {
    if (current === animations) current = null;
  };
}

const isPast = (animation: Animation) => Number(animation.currentTime ?? 0) >= Number(animation.effect?.getComputedTiming().endTime ?? 0);

/** Pauses every registered animation at `ms` into the intro, or resumes them from there for null. False when no intro is running. */
export function holdIntro(ms: number | null): boolean {
  if (!current) return false;
  for (const animation of current) {
    if (ms !== null) {
      animation.pause();
      animation.currentTime = ms;
    } else if (isPast(animation)) animation.finish(); // play() would rewind a finished animation
    else animation.play();
  }
  return true;
}
