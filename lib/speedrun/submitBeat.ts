export type SubmitBeat = {
  begin(run: () => void, delayMs: number): void;
  cancel(): void;
  isActive(): boolean;
};

// The "building your network" beat on the join card. It stays active after `run`
// fires, until something ends it: a failed upload, Start over, or the card leaving.
export function createSubmitBeat(): SubmitBeat {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    begin(run, delayMs) {
      stop();
      active = true;
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    cancel() {
      stop();
      active = false;
    },
    isActive: () => active,
  };
}
