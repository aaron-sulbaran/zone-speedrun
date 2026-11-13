import { describe, expect, it } from "vitest";
import { DESK_SAMPLES, rivalsFor, type DeskStage } from "./deskSamples";
import { deskColumns, deskStep, INITIAL_DESK, stageOf, type DeskAction, type DeskState } from "./desk";
import type { IntroRequest, IntroStatus } from "./introRequest";
import type { Match } from "./match";
import { matchKey } from "./matchList";

const M: Match = {
  company: { name: "Halcyon Works", slug: "halcyon", logo: null, cohort: null, stage: null, blurb: "blurb" },
  role: { id: "r1", fn: "product", title: "Product Engineer" } as Match["role"],
  score: 1,
  reasons: [],
  connect: ["intro"],
};

function req(status: IntroStatus, introSent = false): IntroRequest {
  return {
    candidate: { firstName: "Alex", headline: "PM", shipped: [], kind: "visitor" },
    match: M,
    matchKey: matchKey(M),
    ranked: [matchKey(M)],
    fit: { whyThem: "a", whyRole: "b" },
    status,
    introSent,
    passedBy: status === "passed" ? "team" : null,
  };
}

const desk = (patch: Partial<DeskState> = {}): DeskState => ({ ...INITIAL_DESK, ...patch });
const rivalId = rivalsFor(M)[0].id;

describe("INITIAL_DESK", () => {
  it("starts at arrive with no panel in requested", () => {
    expect(INITIAL_DESK).toMatchObject({ beat: "arrive", panel: null, stage: "requested", founderOpen: false, sampleSeen: false });
  });
});

describe("review", () => {
  it("opens compare when requested", () => {
    const out = deskStep(desk(), req("requested"), { type: "review" });
    expect(out.desk).toMatchObject({ panel: "compare", beat: "review" });
    expect(out.effect).toBeNull();
  });
  it.each(["withFounder", "connected", "passed"] as const)("is refused when %s", (status) => {
    const d = desk();
    expect(deskStep(d, req(status), { type: "review" })).toEqual({ desk: d, effect: null });
  });
  it("is refused with no request", () => {
    const d = desk();
    expect(deskStep(d, null, { type: "review" })).toEqual({ desk: d, effect: null });
  });
});

describe("send", () => {
  it("advances to withFounder from compare", () => {
    const out = deskStep(desk({ panel: "compare" }), req("requested"), { type: "send" });
    expect(out.effect).toEqual({ type: "advance", to: "withFounder" });
    expect(out.desk).toMatchObject({ panel: null, founderOpen: true, beat: "sent", stage: "withFounder" });
  });
  it("is refused without the compare panel or when not requested", () => {
    const a = desk();
    expect(deskStep(a, req("requested"), { type: "send" })).toEqual({ desk: a, effect: null });
    const b = desk({ panel: "compare" });
    expect(deskStep(b, req("withFounder"), { type: "send" })).toEqual({ desk: b, effect: null });
  });
});

describe("sendInstead", () => {
  it("passes by team and records the rival", () => {
    const out = deskStep(desk({ panel: "compare" }), req("requested"), { type: "sendInstead", rivalId });
    expect(out.effect).toEqual({ type: "pass", by: "team" });
    expect(out.desk).toMatchObject({ panel: null, rivalSent: rivalId, beat: "sentInstead", stage: "requested" });
  });
  it("is refused for an unknown rival, without compare, or when not requested", () => {
    const a = desk({ panel: "compare" });
    expect(deskStep(a, req("requested"), { type: "sendInstead", rivalId: "nope" })).toEqual({ desk: a, effect: null });
    const b = desk();
    expect(deskStep(b, req("requested"), { type: "sendInstead", rivalId })).toEqual({ desk: b, effect: null });
    expect(deskStep(a, req("withFounder"), { type: "sendInstead", rivalId })).toEqual({ desk: a, effect: null });
  });
});

describe("openFounder", () => {
  it("opens the founder card when withFounder", () => {
    const out = deskStep(desk(), req("withFounder"), { type: "openFounder" });
    expect(out.desk.founderOpen).toBe(true);
    expect(out.effect).toBeNull();
  });
  it("is refused otherwise", () => {
    const d = desk();
    for (const status of ["requested", "connected", "passed"] as const) {
      expect(deskStep(d, req(status), { type: "openFounder" })).toEqual({ desk: d, effect: null });
    }
  });
});

describe("founder", () => {
  const open = desk({ founderOpen: true, stage: "withFounder" });
  it("yes advances to connected and opens the intro panel", () => {
    const out = deskStep(open, req("withFounder"), { type: "founder", yes: true });
    expect(out.effect).toEqual({ type: "advance", to: "connected" });
    expect(out.desk).toMatchObject({ founderOpen: false, panel: "intro", beat: "interested", stage: "connected" });
  });
  it("no passes by founder and returns to requested", () => {
    const out = deskStep(open, req("withFounder"), { type: "founder", yes: false });
    expect(out.effect).toEqual({ type: "pass", by: "founder" });
    expect(out.desk).toMatchObject({ founderOpen: false, panel: null, beat: "notNow", stage: "requested" });
  });
  it("is refused before send (founder card never opened) or when not withFounder", () => {
    // Catches: a gate skipped by answering for the founder early
    const closed = desk();
    expect(deskStep(closed, req("withFounder"), { type: "founder", yes: true })).toEqual({ desk: closed, effect: null });
    expect(deskStep(closed, req("requested"), { type: "founder", yes: true })).toEqual({ desk: closed, effect: null });
    expect(deskStep(open, req("requested"), { type: "founder", yes: false })).toEqual({ desk: open, effect: null });
    expect(deskStep(open, req("connected"), { type: "founder", yes: true })).toEqual({ desk: open, effect: null });
  });
});

describe("sendIntro", () => {
  it("sends once connected", () => {
    const out = deskStep(desk({ stage: "connected" }), req("connected"), { type: "sendIntro" });
    expect(out.effect).toEqual({ type: "sendIntro" });
    expect(out.desk).toMatchObject({ panel: "intro", beat: "introSent" });
  });
  it("is refused before founder yes, and once already sent", () => {
    // Catches: an intro sent before the founder said yes
    const d = desk();
    expect(deskStep(d, req("withFounder"), { type: "sendIntro" })).toEqual({ desk: d, effect: null });
    expect(deskStep(d, req("requested"), { type: "sendIntro" })).toEqual({ desk: d, effect: null });
    expect(deskStep(d, req("connected", true), { type: "sendIntro" })).toEqual({ desk: d, effect: null });
    expect(deskStep(d, null, { type: "sendIntro" })).toEqual({ desk: d, effect: null });
  });
});

describe("twoWeeks", () => {
  const landed = { panel: "sample", beat: "twoWeeks", stage: "outcome", sampleSeen: true } as const;
  it("is legal with a null request", () => {
    const out = deskStep(desk(), null, { type: "twoWeeks" });
    expect(out.desk).toMatchObject(landed);
    expect(out.effect).toBeNull();
  });
  it("is legal when connected and the intro is sent", () => {
    expect(deskStep(desk(), req("connected", true), { type: "twoWeeks" }).desk).toMatchObject(landed);
  });
  it("is refused otherwise", () => {
    const d = desk();
    expect(deskStep(d, req("connected", false), { type: "twoWeeks" })).toEqual({ desk: d, effect: null });
    expect(deskStep(d, req("requested"), { type: "twoWeeks" })).toEqual({ desk: d, effect: null });
    expect(deskStep(d, req("withFounder"), { type: "twoWeeks" })).toEqual({ desk: d, effect: null });
    expect(deskStep(d, req("passed"), { type: "twoWeeks" })).toEqual({ desk: d, effect: null });
  });
});

describe("always-legal actions", () => {
  it("closePanel clears the panel and the founder card in any state", () => {
    for (const r of [null, req("requested"), req("withFounder"), req("passed")]) {
      const out = deskStep(desk({ panel: "intro", founderOpen: true }), r, { type: "closePanel" });
      expect(out.desk).toMatchObject({ panel: null, founderOpen: false });
      expect(out.effect).toBeNull();
    }
  });
  it("selectStage sets the stage", () => {
    for (const r of [null, req("connected")]) {
      expect(deskStep(desk(), r, { type: "selectStage", stage: "tracking" }).desk.stage).toBe("tracking");
    }
  });
  it("arrived sets arrivedKey", () => {
    expect(deskStep(desk(), null, { type: "arrived", key: "k" }).desk.arrivedKey).toBe("k");
  });
});

it("returns the same desk object for every refused action", () => {
  const d = desk();
  const refused: DeskAction[] = [{ type: "send" }, { type: "openFounder" }, { type: "sendIntro" }];
  for (const action of refused) expect(deskStep(d, null, action).desk).toBe(d);
});

describe("stageOf", () => {
  it("maps the live statuses and nulls the rest", () => {
    expect(stageOf(req("requested"))).toBe("requested");
    expect(stageOf(req("withFounder"))).toBe("withFounder");
    expect(stageOf(req("connected"))).toBe("connected");
    expect(stageOf(req("passed"))).toBeNull();
    expect(stageOf(null)).toBeNull();
  });
});

describe("deskColumns", () => {
  it("puts the visitor's card first in its stage", () => {
    const cols = deskColumns(req("withFounder"), "Alex");
    expect(cols.withFounder[0]).toMatchObject({ mine: true, firstName: "Alex", company: "Halcyon Works", role: "Product Engineer", stage: "withFounder", pill: "", id: "mine" });
    expect(cols.withFounder.filter((c) => c.mine)).toHaveLength(1);
  });
  // Catches: the visitor's own card titled in lowercase when the no-name fallback is the title.
  it("titles the visitor's card with a capital when the name is the no-name fallback", () => {
    const cols = deskColumns(req("withFounder"), "this candidate");
    expect(cols.withFounder[0].firstName).toBe("This candidate");
  });
  it("adds no visitor card for null or passed", () => {
    for (const r of [null, req("passed")]) {
      const all = Object.values(deskColumns(r, "Alex")).flat();
      expect(all.some((c) => c.mine)).toBe(false);
    }
  });
  it("keeps every sample card, unmarked", () => {
    const all = Object.values(deskColumns(req("requested"), "Alex")).flat();
    for (const sample of DESK_SAMPLES) expect(all).toContainEqual({ ...sample, mine: false });
    expect(all).toHaveLength(DESK_SAMPLES.length + 1);
  });
  it("uses an empty role string when the match has no role", () => {
    const r = { ...req("requested"), match: { ...M, role: null } };
    expect(deskColumns(r, "Alex").requested[0].role).toBe("");
  });
  it("has all five columns", () => {
    const stages: DeskStage[] = ["requested", "withFounder", "connected", "tracking", "outcome"];
    expect(Object.keys(deskColumns(null, "A")).sort()).toEqual([...stages].sort());
  });
});

describe("openIntro", () => {
  it("reopens the draft while connected, leaving the beat alone", () => {
    const out = deskStep(desk({ beat: "interested" }), req("connected"), { type: "openIntro" });
    expect(out.desk).toMatchObject({ panel: "intro", beat: "interested" });
    expect(out.effect).toBeNull();
  });
  it.each(["requested", "withFounder", "passed"] as const)("is refused when %s", (status) => {
    const d = desk();
    expect(deskStep(d, req(status), { type: "openIntro" })).toEqual({ desk: d, effect: null });
  });
  it("is refused with no request", () => {
    const d = desk();
    expect(deskStep(d, null, { type: "openIntro" })).toEqual({ desk: d, effect: null });
  });
});

describe("settle", () => {
  it("closes every panel and returns the beat to arrive, keeping the stage and the sample flag", () => {
    const d = desk({ panel: "compare", founderOpen: true, beat: "review", stage: "withFounder", sampleSeen: true });
    const out = deskStep(d, null, { type: "settle" });
    expect(out.desk).toMatchObject({ panel: null, founderOpen: false, beat: "arrive", stage: "withFounder", sampleSeen: true });
    expect(out.effect).toBeNull();
  });
  // Catches: a phone left on a stale column when a request lands (the narration talks about a card that is off screen).
  it("selects the live request's stage, and keeps the stage with no request", () => {
    const d = desk({ stage: "outcome", beat: "twoWeeks" });
    expect(deskStep(d, req("requested"), { type: "settle" }).desk.stage).toBe("requested");
    expect(deskStep(d, req("connected"), { type: "settle" }).desk.stage).toBe("connected");
    expect(deskStep(d, null, { type: "settle" }).desk.stage).toBe("outcome");
  });
});
