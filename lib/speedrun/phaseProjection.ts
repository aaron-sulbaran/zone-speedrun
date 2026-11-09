import { phaseReducer, type PhaseEvent, type PhaseState } from "./phase";

/**
 * What an event does to the phase as it will stand once the queued events have
 * run. `changes` is false when the reducer would ignore it, so the caller can
 * skip the frame exit for it.
 */
export function offerAgainst(projected: PhaseState, event: PhaseEvent): { next: PhaseState; changes: boolean } {
  const next = phaseReducer(projected, event);
  return { next, changes: next.phase !== projected.phase || next.tab !== projected.tab };
}
