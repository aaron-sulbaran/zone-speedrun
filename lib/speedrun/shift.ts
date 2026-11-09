// The shift: a one-second sweep from Act 1 (my style) into Act 2 (theirs).
// Pure phase logic; the Web Animations live in components/speedrun/Shift.tsx.

// Its durations are in lib/speedrun/motion.ts.

export type ShiftPhase = "idle" | "covering" | "covered" | "revealing";
export type ShiftEvent = "go" | "covered" | "revealed" | "abort";

// "covered" fires twice per run: the cover finishing (covering to covered, the
// page jumps and holds) and the hold ending (covered to revealing).
export function shiftReducer(state: ShiftPhase, event: ShiftEvent): ShiftPhase {
  if (event === "abort") return "idle";
  if (event === "go") return state === "idle" ? "covering" : state;
  if (event === "covered") {
    if (state === "covering") return "covered";
    if (state === "covered") return "revealing";
    return state;
  }
  return state === "revealing" ? "idle" : state;
}
