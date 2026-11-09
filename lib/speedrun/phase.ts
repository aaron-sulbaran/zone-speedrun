export type Phase = "opener" | "join" | "building" | "network";
export type NetworkTab = "matches" | "board" | "brief" | "decisions";

export const NETWORK_TABS: readonly NetworkTab[] = ["matches", "board", "brief", "decisions"];

export type PhaseState = { phase: Phase; tab: NetworkTab };

export const INITIAL_PHASE: PhaseState = { phase: "opener", tab: "matches" };

export type PhaseEvent =
  | { type: "enterJoin" }
  | { type: "build" }
  | { type: "buildFailed" }
  | { type: "logDone" }
  | { type: "tab"; tab: NetworkTab }
  | { type: "startOver" }
  | { type: "replayTop" };

export function phaseReducer(state: PhaseState, event: PhaseEvent): PhaseState {
  switch (event.type) {
    case "enterJoin":
      return state.phase === "opener" ? { phase: "join", tab: "matches" } : state;
    case "build":
      return state.phase === "join" ? { ...state, phase: "building" } : state;
    case "buildFailed":
      return state.phase === "building" ? { ...state, phase: "join" } : state;
    case "logDone":
      return state.phase === "building" ? { phase: "network", tab: "matches" } : state;
    case "tab":
      return state.phase === "network" ? { ...state, tab: event.tab } : state;
    case "startOver":
      return state.phase === "opener" ? state : { phase: "join", tab: "matches" };
    case "replayTop":
      return { phase: "opener", tab: "matches" };
  }
}
