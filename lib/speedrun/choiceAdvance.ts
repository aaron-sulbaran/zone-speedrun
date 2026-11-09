export type ChoiceAdvance = { schedule(): void; cancel(): void };

// Advances once, `delayMs` after the last answer. A new answer inside the delay
// restarts the clock, so Yes then No advances one time, on No.
export function createChoiceAdvance(advance: () => void, delayMs: number): ChoiceAdvance {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        advance();
      }, delayMs);
    },
    cancel,
  };
}
