import type { Motion } from "./motion";

// Overrides for the motion constants, so a lab can tune a value live without
// touching the constants. Nothing reads these in production unless a lab sets them.
let overrides: Partial<Motion> = {};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setMotionOverrides(patch: Partial<Motion>): void {
  overrides = { ...overrides, ...patch };
  notify();
}

export function resetMotionOverrides(): void {
  overrides = {};
  notify();
}

export function getMotionOverrides(): Partial<Motion> {
  return overrides;
}

export function subscribeMotion(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
