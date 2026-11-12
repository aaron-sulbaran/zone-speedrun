export type Phase = "opener" | "join" | "building" | "network";
export type NetworkTab = "matches" | "board" | "brief" | "decisions";

export const NETWORK_TABS: readonly NetworkTab[] = ["matches", "board", "brief", "decisions"];

/** The tab after this one, or null on the last. */
export function nextTab(tab: NetworkTab): NetworkTab | null {
  return NETWORK_TABS[NETWORK_TABS.indexOf(tab) + 1] ?? null;
}

/** Which desk the network phase shows: the candidate's tabs, or the talent team's. */
export type Side = "candidate" | "team";

export type PhaseState = { phase: Phase; tab: NetworkTab; side: Side };

export const INITIAL_PHASE: PhaseState = { phase: "opener", tab: "matches", side: "candidate" };

export type PhaseEvent =
  | { type: "enterJoin" }
  | { type: "build" }
  | { type: "buildFailed" }
  | { type: "logDone" }
  | { type: "tab"; tab: NetworkTab }
  | { type: "side"; side: Side; tab?: NetworkTab }
  | { type: "startOver" }
  | { type: "replayTop" };

export function phaseReducer(state: PhaseState, event: PhaseEvent): PhaseState {
  switch (event.type) {
    case "enterJoin":
      return state.phase === "opener" ? { phase: "join", tab: "matches", side: "candidate" } : state;
    case "build":
      return state.phase === "join" ? { ...state, phase: "building" } : state;
    case "buildFailed":
      return state.phase === "building" ? { ...state, phase: "join" } : state;
    case "logDone":
      return state.phase === "building" ? { phase: "network", tab: "matches", side: "candidate" } : state;
    case "tab":
      return state.phase === "network" ? { ...state, tab: event.tab } : state;
    case "side":
      return state.phase === "network" ? { ...state, side: event.side, tab: event.tab ?? state.tab } : state;
    case "startOver":
      return state.phase === "opener" ? state : { phase: "join", tab: "matches", side: "candidate" };
    case "replayTop":
      return { phase: "opener", tab: "matches", side: "candidate" };
  }
}

/** The phase event a demo step change calls for, or null when the phase does not follow it. */
export function phaseEventFor(before: "join" | "building" | "ready", after: "join" | "building" | "ready"): PhaseEvent | null {
  if (before === "join" && after === "building") return { type: "build" };
  // Ready counts too: a match can land during the join exit, and Start over then resets it to join.
  if (after === "join" && before !== "join") return { type: "buildFailed" };
  return null;
}
