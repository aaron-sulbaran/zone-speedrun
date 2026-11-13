import { describe, expect, it } from "vitest";
import { INITIAL_PHASE, NETWORK_TABS, nextTab, phaseEventFor, phaseReducer, type PhaseState } from "./phase";

const at = (phase: PhaseState["phase"], tab: PhaseState["tab"] = "matches", side: PhaseState["side"] = "candidate"): PhaseState => ({ phase, tab, side });

describe("phaseReducer", () => {
  it("starts at the opener on matches", () => {
    expect(INITIAL_PHASE).toEqual(at("opener"));
    expect(NETWORK_TABS).toEqual(["matches", "board", "brief", "decisions"]);
  });
  it("walks opener to join to building to network", () => {
    let s = phaseReducer(INITIAL_PHASE, { type: "enterJoin" });
    expect(s.phase).toBe("join");
    s = phaseReducer(s, { type: "build" });
    expect(s.phase).toBe("building");
    s = phaseReducer(at("building", "brief"), { type: "logDone" });
    expect(s).toEqual(at("network", "matches"));
  });
  it("sends a failed build back to join", () => {
    expect(phaseReducer(at("building"), { type: "buildFailed" }).phase).toBe("join");
  });
  it("ignores events from the wrong phase with the same object", () => {
    const join = at("join");
    expect(phaseReducer(join, { type: "enterJoin" })).toBe(join);
    const opener = at("opener");
    expect(phaseReducer(opener, { type: "build" })).toBe(opener);
    expect(phaseReducer(opener, { type: "logDone" })).toBe(opener);
    expect(phaseReducer(opener, { type: "buildFailed" })).toBe(opener);
    expect(phaseReducer(join, { type: "tab", tab: "board" })).toBe(join);
    expect(phaseReducer(opener, { type: "startOver" })).toBe(opener);
  });
  it("changes tabs only in network", () => {
    expect(phaseReducer(at("network"), { type: "tab", tab: "decisions" })).toEqual(at("network", "decisions"));
  });
  it("starts over to join with matches, from network", () => {
    expect(phaseReducer(at("network", "brief"), { type: "startOver" })).toEqual(at("join", "matches"));
    expect(phaseReducer(at("building"), { type: "startOver" }).phase).toBe("join");
  });
  it("replays the top from anywhere", () => {
    expect(phaseReducer(at("building"), { type: "replayTop" })).toEqual(at("opener"));
    expect(phaseReducer(at("network", "board"), { type: "replayTop" })).toEqual(at("opener", "matches"));
  });
});

describe("side", () => {
  it("flips only in the network phase, and returns the same object elsewhere", () => {
    expect(phaseReducer(at("network", "board"), { type: "side", side: "team" })).toEqual(at("network", "board", "team"));
    for (const phase of ["opener", "join", "building"] as const) {
      const state = at(phase);
      expect(phaseReducer(state, { type: "side", side: "team" })).toBe(state);
    }
  });
  it("sets the tab too when the event carries one (back to Matches)", () => {
    expect(phaseReducer(at("network", "brief", "team"), { type: "side", side: "candidate", tab: "matches" })).toEqual(at("network", "matches", "candidate"));
  });
  it("keeps the tab when the event carries none", () => {
    expect(phaseReducer(at("network", "decisions", "team"), { type: "side", side: "candidate" })).toEqual(at("network", "decisions", "candidate"));
  });
  it("resets to the candidate side on logDone, startOver and replayTop", () => {
    expect(phaseReducer(at("building"), { type: "logDone" }).side).toBe("candidate");
    expect(phaseReducer(at("network", "brief", "team"), { type: "startOver" })).toEqual(at("join", "matches", "candidate"));
    expect(phaseReducer(at("network", "board", "team"), { type: "replayTop" })).toEqual(at("opener", "matches", "candidate"));
    expect(phaseReducer(at("opener"), { type: "enterJoin" }).side).toBe("candidate");
  });
});

describe("phaseEventFor", () => {
  it("maps the two demo transitions the phase follows", () => {
    expect(phaseEventFor("join", "building")).toEqual({ type: "build" });
    expect(phaseEventFor("building", "join")).toEqual({ type: "buildFailed" });
    expect(phaseEventFor("building", "ready")).toBeNull();
    expect(phaseEventFor("ready", "join")).toEqual({ type: "buildFailed" });
    expect(phaseEventFor("join", "join")).toBeNull();
  });
});

describe("nextTab", () => {
  it("walks matches to board to brief to decisions, then stops", () => {
    expect(nextTab("matches")).toBe("board");
    expect(nextTab("board")).toBe("brief");
    expect(nextTab("brief")).toBe("decisions");
    expect(nextTab("decisions")).toBeNull();
  });
});
