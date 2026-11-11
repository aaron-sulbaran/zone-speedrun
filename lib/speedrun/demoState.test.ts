import { describe, expect, it } from "vitest";
import { demoReducer, initialDemoState } from "./demoState";
import { stepsFor } from "./onboarding";
import { PEOPLE } from "./people";
import { createRequest } from "./introRequest";
import type { Match } from "./match";
import { matchKey } from "./matchList";

const LIVE = { reading: false, email: false };

function match(name: string, connect: Match["connect"]): Match {
  return {
    company: { name, slug: name.toLowerCase(), logo: null, cohort: null, stage: null, blurb: `${name} blurb` },
    role: null,
    score: 1,
    reasons: [],
    connect,
  };
}
const A = match("A", ["intro"]);
const B = match("B", ["intro"]);
const C = match("C", ["intro"]);
const CANDIDATE = { firstName: "Alex", headline: "PM", shipped: [], kind: "visitor" as const };
const request = (shortlist: Match[]) => createRequest({ candidate: CANDIDATE, shortlist, intake: initialDemoState(LIVE).intake })!;

describe("demoReducer join steps", () => {
  it("walks joinStep to the last step and stops there", () => {
    let state = initialDemoState(LIVE);
    state = demoReducer(state, { type: "answer", patch: { targets: ["design"] } });
    const seen: number[] = [state.joinStep];
    for (let i = 0; i < 5; i++) {
      state = demoReducer(state, { type: "next" });
      seen.push(state.joinStep);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    for (let i = 0; i < 5; i++) state = demoReducer(state, { type: "next" });
    expect(state.joinStep).toBe(6);
    expect(state.intake.targets).toEqual(["design"]);
    expect(state.step).toBe("join");
  });

  it("keeps joinStep at 0 when going back from the start", () => {
    const state = demoReducer(initialDemoState(LIVE), { type: "back" });
    expect(state.joinStep).toBe(0);
  });

  it("goes back one step", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "next" });
    state = demoReducer(state, { type: "back" });
    expect(state.joinStep).toBe(0);
  });

  it("merges answers without dropping the other fields", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { places: ["Remote"] } });
    state = demoReducer(state, { type: "answer", patch: { why: "Build." } });
    expect(state.intake).toEqual({ targets: [], places: ["Remote"], why: "Build." });
    expect(state.answers.name).toBe("");
  });
});

describe("demoReducer pickPerson", () => {
  it("uses Dev's own intake when nothing was answered, and moves to building", () => {
    const state = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "dev" });
    expect(state.intake).toEqual(PEOPLE.dev.intake);
    expect(state.personKey).toBe("dev");
    expect(state.step).toBe("building");
  });

  it("keeps the visitor's answers when they gave any", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { targets: ["data"] } });
    state = demoReducer(state, { type: "pickPerson", key: "dev" });
    expect(state.intake.targets).toEqual(["data"]);
    expect(state.step).toBe("building");
  });

  it("gives a re-pick the new person's own intake when the visitor answered nothing", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "dev" });
    state = demoReducer(state, { type: "pickPerson", key: "sam" });
    expect(state.intake).toEqual(PEOPLE.sam.intake);
    expect(state.answers).toEqual(initialDemoState(LIVE).answers);
  });

  it("keeps the visitor's answers across re-picks", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { why: "Build." } });
    state = demoReducer(state, { type: "pickPerson", key: "dev" });
    state = demoReducer(state, { type: "pickPerson", key: "sam" });
    expect(state.intake.why).toBe("Build.");
  });

  it("caps places at 8", () => {
    const places = Array.from({ length: 12 }, (_, i) => `City ${i}`);
    const state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { places } });
    expect(state.answers.places).toHaveLength(8);
  });

  it("records the inbox and calendar connections", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "connectInbox", on: true });
    expect([state.inboxConnected, state.calendarConnected]).toEqual([true, false]);
    state = demoReducer(state, { type: "connectCalendar", on: true });
    expect(state.calendarConnected).toBe(true);
    state = demoReducer(state, { type: "connectInbox", on: false });
    expect(state.inboxConnected).toBe(false);
  });

  it("treats a whitespace-only why as unanswered", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { why: "   " } });
    state = demoReducer(state, { type: "pickPerson", key: "maya" });
    expect(state.intake).toEqual(PEOPLE.maya.intake);
  });

  it("reaches ready once built, and reset returns to the start", () => {
    let state = demoReducer(initialDemoState({ reading: true, email: false }), { type: "pickPerson", key: "sam" });
    const result = { matches: [], routes: [], narrowing: { companies: 0, roles: 0, speedrunRoles: 0, a16zRoles: 0, afterFilters: 0, shown: 0 } };
    state = demoReducer(state, { type: "built", buildId: state.buildId, profile: PEOPLE.sam.profile, result });
    expect(state.step).toBe("ready");
    expect(state.profile).toBe(PEOPLE.sam.profile);
    state = demoReducer(state, { type: "reset" });
    expect({ ...state, buildId: 0 }).toEqual(initialDemoState({ reading: true, email: false }));
  });

  it("moves to building on upload, then to ready from the response", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "uploaded", buildId: 1 });
    expect(state.step).toBe("building");
    expect(state.personKey).toBeNull();
    expect(state.profile).toBeNull();
    const result = { matches: [], routes: [], narrowing: { companies: 0, roles: 0, speedrunRoles: 0, a16zRoles: 0, afterFilters: 0, shown: 0 } };
    state = demoReducer(state, { type: "built", buildId: state.buildId, profile: PEOPLE.lena.profile, result });
    expect(state.step).toBe("ready");
    expect(state.profile).toBe(PEOPLE.lena.profile);
  });

  it("returns to the join step with the error when an upload fails, and ignores a stray failure", () => {
    const building = demoReducer(initialDemoState(LIVE), { type: "uploaded", buildId: 1 });
    const failed = demoReducer(building, { type: "uploadFailed", buildId: 1, error: "unreadable" });
    expect(failed.step).toBe("join");
    expect(failed.uploadError).toBe("unreadable");
    const sample = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "sam" });
    expect(demoReducer(sample, { type: "uploadFailed", buildId: 1, error: "network" })).toBe(sample);
  });

  it("clears the upload error on the next upload, pick and reset", () => {
    const failed = demoReducer(demoReducer(initialDemoState(LIVE), { type: "uploaded", buildId: 1 }), { type: "uploadFailed", buildId: 1, error: "bot" });
    expect(demoReducer(failed, { type: "uploaded", buildId: 1 }).uploadError).toBeNull();
    expect(demoReducer(failed, { type: "pickPerson", key: "sam" }).uploadError).toBeNull();
    expect(demoReducer(failed, { type: "reset" }).uploadError).toBeNull();
  });
});

describe("demoReducer onboarding answers", () => {
  const result = { matches: [], routes: [], narrowing: { companies: 0, roles: 0, speedrunRoles: 0, a16zRoles: 0, afterFilters: 0, shown: 0 } };

  it("drops arrangements and seniority when student flips back to no", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { student: true } });
    state = demoReducer(state, { type: "answer", patch: { arrangements: ["between"] } });
    expect(state.intake.seniority).toBe("intern");
    for (let i = 0; i < 4; i++) state = demoReducer(state, { type: "next" });
    expect(state.joinStep).toBe(4);
    state = demoReducer(state, { type: "answer", patch: { student: false } });
    expect(state.answers.arrangements).toEqual([]);
    expect(stepsFor(state.answers)).toHaveLength(7);
    expect(state.joinStep).toBeLessThanOrEqual(6);
    expect(state.intake.seniority).toBeUndefined();
  });

  it("clamps joinStep into the shorter list", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { student: true } });
    for (let i = 0; i < 9; i++) state = demoReducer(state, { type: "next" });
    expect(state.joinStep).toBe(7);
    state = demoReducer(state, { type: "answer", patch: { student: false } });
    expect(state.joinStep).toBe(6);
  });

  it("counts founding and student as answers the match uses", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { founding: true } });
    state = demoReducer(state, { type: "pickPerson", key: "dev" });
    expect(state.intake.founding).toBe(true);
  });

  it("keeps the name out of the intake", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "answer", patch: { name: "Alex", targets: ["data"] } });
    expect(JSON.stringify(state.intake)).not.toContain("Alex");
    state = demoReducer(state, { type: "pickPerson", key: "dev" });
    expect(JSON.stringify(state.intake)).not.toContain("Alex");
  });

  it("ignores a stale build after reset", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "sam" });
    const stale = state.buildId;
    state = demoReducer(state, { type: "reset" });
    expect(state.buildId).not.toBe(stale);
    state = demoReducer(state, { type: "built", buildId: stale, profile: PEOPLE.sam.profile, result });
    expect(state.profile).toBeNull();
    expect(state.result).toBeNull();
    expect(state.step).toBe("join");
  });

  it("ignores a stale build for a replaced pick", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "sam" });
    const stale = state.buildId;
    state = demoReducer(state, { type: "pickPerson", key: "dev" });
    state = demoReducer(state, { type: "built", buildId: stale, profile: PEOPLE.sam.profile, result });
    expect(state.step).toBe("building");
    expect(state.profile).toBeNull();
  });

  it("ignores a stale upload failure after reset and a second upload", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "uploaded", buildId: 1 });
    state = demoReducer(state, { type: "reset" });
    state = demoReducer(state, { type: "uploaded", buildId: state.buildId + 1 });
    const second = state;
    state = demoReducer(state, { type: "uploadFailed", buildId: 1, error: "bot" });
    expect(state).toBe(second);
    expect(state.step).toBe("building");
    expect(state.uploadError).toBeNull();
    state = demoReducer(state, { type: "built", buildId: second.buildId, profile: PEOPLE.sam.profile, result });
    expect(state.step).toBe("ready");
  });

  it("ignores built while on the join step", () => {
    const state = initialDemoState(LIVE);
    expect(demoReducer(state, { type: "built", buildId: state.buildId, profile: PEOPLE.sam.profile, result })).toBe(state);
  });
});

describe("demoReducer pasted events", () => {
  const pasted = { emailId: "pasted-1", company: "Halcyon Works", role: null, kind: "interview", date: "2026-11-07T08:00:00.000Z", lane: "jobs" } as const;

  it("clears pasted events when another person is picked or a file is uploaded", () => {
    const withEvent = demoReducer(demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "sam" }), { type: "addEvents", events: [pasted] });
    expect(withEvent.events).toHaveLength(1);
    expect(demoReducer(withEvent, { type: "pickPerson", key: "dev" }).events).toEqual([]);
    expect(demoReducer(withEvent, { type: "uploaded", buildId: 1 }).events).toEqual([]);
  });
})

describe("demoReducer events", () => {
  it("appends events", () => {
    const event = { emailId: "e1", company: "Acme", role: null, kind: "applied", date: "2026-11-01", lane: "jobs" } as const;
    const state = demoReducer(initialDemoState(LIVE), { type: "addEvents", events: [event] });
    expect(state.events).toEqual([event]);
  });
});

describe("uploadRejected", () => {
  it("shows the error on the join step without ever building, and bumps the id so a repeat is seen", () => {
    const start = initialDemoState(LIVE);
    const first = demoReducer(start, { type: "uploadRejected", error: "bad_input" });
    expect(first).toMatchObject({ step: "join", uploadError: "bad_input", buildId: start.buildId + 1 });
    const second = demoReducer(first, { type: "uploadRejected", error: "bad_input" });
    expect(second.buildId).toBe(first.buildId + 1);
  });

  it("is ignored once a build is under way", () => {
    const building = demoReducer(initialDemoState(LIVE), { type: "uploaded", buildId: 1 });
    expect(demoReducer(building, { type: "uploadRejected", error: "bad_input" })).toBe(building);
  });
});

describe("demoReducer shortlist, intro request and done set", () => {
  const withKeys = (keys: string[]) => keys.reduce((state, key) => demoReducer(state, { type: "bringForward", key, on: true }), initialDemoState(LIVE));

  it("bringForward adds a key once and removes it when off", () => {
    let state = withKeys(["a"]);
    state = demoReducer(state, { type: "bringForward", key: "a", on: true });
    expect(state.shortlist).toEqual(["a"]);
    state = demoReducer(state, { type: "bringForward", key: "a", on: false });
    expect(state.shortlist).toEqual([]);
  });

  it("moveShortlist reorders and leaves the request's key alone", () => {
    const keys = [matchKey(A), matchKey(B), matchKey(C)];
    let state = withKeys(keys);
    state = demoReducer(state, { type: "requestIntro", request: request([A, B, C]) });
    state = demoReducer(state, { type: "moveShortlist", key: matchKey(B), direction: -1 });
    expect(state.shortlist).toEqual([matchKey(B), matchKey(A), matchKey(C)]);
    expect(state.introRequest?.matchKey).toBe(matchKey(A));
    expect(demoReducer(state, { type: "moveShortlist", key: matchKey(B), direction: -1 }).shortlist).toEqual(state.shortlist);
  });

  it("removing the requested key clears the request", () => {
    let state = withKeys([matchKey(A), matchKey(B)]);
    state = demoReducer(state, { type: "requestIntro", request: request([A, B]) });
    expect(demoReducer(state, { type: "bringForward", key: matchKey(B), on: false }).introRequest).not.toBeNull();
    expect(demoReducer(state, { type: "bringForward", key: matchKey(A), on: false }).introRequest).toBeNull();
  });

  it("swapIntro moves the new pick to the front of the shortlist", () => {
    let state = withKeys([matchKey(A), matchKey(B), matchKey(C)]);
    state = demoReducer(state, { type: "requestIntro", request: request([A, B, C]) });
    const swapped = { ...request([C, A, B]) };
    state = demoReducer(state, { type: "swapIntro", request: swapped });
    expect(state.introRequest?.matchKey).toBe(matchKey(C));
    expect(state.shortlist).toEqual([matchKey(C), matchKey(A), matchKey(B)]);
  });

  it("markDone is idempotent", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "markDone", id: "x" });
    state = demoReducer(state, { type: "markDone", id: "x" });
    expect(state.done).toEqual(["x"]);
  });

  it("pickPerson, built and reset clear all three", () => {
    const dirty = () => {
      let state = withKeys([matchKey(A)]);
      state = demoReducer(state, { type: "requestIntro", request: request([A]) });
      return demoReducer(state, { type: "markDone", id: "x" });
    };
    const cleared = { shortlist: [], introRequest: null, done: [] };
    expect(demoReducer(dirty(), { type: "pickPerson", key: "dev" })).toMatchObject(cleared);
    expect(demoReducer(dirty(), { type: "reset" })).toMatchObject(cleared);
    const building = { ...dirty(), step: "building" as const, buildId: 3 };
    const built = demoReducer(building, { type: "built", buildId: 3, profile: PEOPLE.dev.profile, result: { matches: [], routes: [], narrowing: { companies: 0, roles: 0, speedrunRoles: 0, a16zRoles: 0, afterFilters: 0, shown: 0 } } });
    expect(built).toMatchObject(cleared);
  });

  it("no longer carries the board-order state or actions", () => {
    const state = initialDemoState(LIVE);
    // @ts-expect-error boardOrder left the state
    void state.boardOrder;
    // @ts-expect-error hidden left the state
    void state.hidden;
    // @ts-expect-error moveCard left the actions
    demoReducer(state, { type: "moveCard", card: "tools", to: 0 });
    // @ts-expect-error toggleCard left the actions
    demoReducer(state, { type: "toggleCard", card: "flow" });
  });
});
