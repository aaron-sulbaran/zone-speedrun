import { describe, expect, it } from "vitest";
import { demoReducer, initialDemoState, type DemoState } from "./demoState";
import { PEOPLE } from "./people";
import type { BoardCard } from "./types";

const LIVE = { reading: false, email: false };
const ALL_CARDS: BoardCard[] = ["today", "matches", "pipeline", "flow", "intros", "tools"];

function everyCardOnce(state: DemoState) {
  expect([...state.boardOrder, ...state.hidden].sort()).toEqual([...ALL_CARDS].sort());
}

describe("demoReducer join steps", () => {
  it("walks joinStep 0 to 3 and stops there", () => {
    let state = initialDemoState(LIVE);
    state = demoReducer(state, { type: "answer", patch: { targets: ["design"] } });
    const seen: number[] = [state.joinStep];
    for (let i = 0; i < 5; i++) {
      state = demoReducer(state, { type: "next" });
      seen.push(state.joinStep);
    }
    expect(seen).toEqual([0, 1, 2, 3, 3, 3]);
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
  });
});

describe("demoReducer pickPerson", () => {
  it("uses Dev's own intake when nothing was answered, and moves to building", () => {
    const state = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "dev" });
    expect(state.intake).toEqual(PEOPLE.dev.intake);
    expect(state.personKey).toBe("dev");
    expect(state.step).toBe("building");
    expect(state.boardOrder).toEqual(PEOPLE.dev.boardOrder);
    everyCardOnce(state);
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
    expect(state.answers).toEqual({ targets: [], places: [], why: "" });
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
    const result = { matches: [], routes: [], narrowing: { companies: 0, roles: 0, afterFilters: 0, shown: 0 } };
    state = demoReducer(state, { type: "built", profile: PEOPLE.sam.profile, result });
    expect(state.step).toBe("ready");
    expect(state.profile).toBe(PEOPLE.sam.profile);
    state = demoReducer(state, { type: "reset" });
    expect(state).toEqual(initialDemoState({ reading: true, email: false }));
  });

  it("moves to building on upload, then to ready from the response", () => {
    let state = demoReducer(initialDemoState(LIVE), { type: "uploaded" });
    expect(state.step).toBe("building");
    expect(state.personKey).toBeNull();
    expect(state.profile).toBeNull();
    const result = { matches: [], routes: [], narrowing: { companies: 0, roles: 0, afterFilters: 0, shown: 0 } };
    state = demoReducer(state, { type: "built", profile: PEOPLE.lena.profile, result });
    expect(state.step).toBe("ready");
    expect(state.profile).toBe(PEOPLE.lena.profile);
  });

  it("returns to the join step when an upload fails, and ignores a stray failure", () => {
    const building = demoReducer(initialDemoState(LIVE), { type: "uploaded" });
    expect(demoReducer(building, { type: "uploadFailed" }).step).toBe("join");
    const sample = demoReducer(initialDemoState(LIVE), { type: "pickPerson", key: "sam" });
    expect(demoReducer(sample, { type: "uploadFailed" })).toBe(sample);
  });
});

describe("demoReducer board cards", () => {
  it("moves a card and keeps every card exactly once", () => {
    let state = initialDemoState(LIVE);
    state = demoReducer(state, { type: "moveCard", card: "tools", to: 0 });
    expect(state.boardOrder[0]).toBe("tools");
    everyCardOnce(state);
    state = demoReducer(state, { type: "moveCard", card: "tools", to: 99 });
    expect(state.boardOrder.at(-1)).toBe("tools");
    everyCardOnce(state);
  });

  it("toggles a card out and back in", () => {
    let state = initialDemoState(LIVE);
    state = demoReducer(state, { type: "toggleCard", card: "flow" });
    expect(state.hidden).toEqual(["flow"]);
    expect(state.boardOrder).not.toContain("flow");
    everyCardOnce(state);
    state = demoReducer(state, { type: "moveCard", card: "flow", to: 0 });
    everyCardOnce(state);
    state = demoReducer(state, { type: "toggleCard", card: "flow" });
    expect(state.hidden).toEqual([]);
    expect(state.boardOrder).toContain("flow");
    everyCardOnce(state);
  });

  it("appends events", () => {
    const event = { emailId: "e1", company: "Acme", role: null, kind: "applied", date: "2026-11-01", lane: "jobs" } as const;
    const state = demoReducer(initialDemoState(LIVE), { type: "addEvents", events: [event] });
    expect(state.events).toEqual([event]);
  });
});
