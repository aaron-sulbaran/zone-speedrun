// Phase changes wait for the current frame to finish leaving. An event that
// arrives during that exit is queued and applied, in order, when it ends, so a
// fast failure right after a build is never dropped.
export type ExitQueue<T> = {
  /** `startExit` is null for a change that needs no exit; it still waits behind a running exit. */
  offer: (change: T, startExit: (() => Promise<void>) | null) => void;
};

export function createExitQueue<T>(apply: (change: T) => void): ExitQueue<T> {
  let pending: T[] | null = null;
  return {
    offer(change, startExit) {
      if (pending) {
        pending.push(change);
        return;
      }
      if (!startExit) {
        apply(change);
        return;
      }
      pending = [change];
      const finish = () => {
        const queued = pending ?? [];
        pending = null;
        queued.forEach(apply);
      };
      startExit().then(finish, finish);
    },
  };
}
