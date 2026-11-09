import { describe, expect, it } from "vitest";
import { INITIAL_PHASE, NETWORK_TABS, phaseEventFor, phaseReducer, type PhaseState } from "./phase";

const at = (phase: PhaseState["phase"], tab: PhaseState["tab"] = "matches"): PhaseState => ({ phase, tab });

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

describe("phaseEventFor", () => {
  it("maps the two demo transitions the phase follows", () => {
    expect(phaseEventFor("join", "building")).toEqual({ type: "build" });
    expect(phaseEventFor("building", "join")).toEqual({ type: "buildFailed" });
    expect(phaseEventFor("building", "ready")).toBeNull();
    expect(phaseEventFor("ready", "join")).toBeNull();
    expect(phaseEventFor("join", "join")).toBeNull();
  });
  it("a build then a fast failure, replayed in order, ends on join", () => {
    const events = [phaseEventFor("join", "building"), phaseEventFor("building", "join")];
    const end = events.reduce((s, e) => (e ? phaseReducer(s, e) : s), at("join"));
    expect(end.phase).toBe("join");
  });
});
