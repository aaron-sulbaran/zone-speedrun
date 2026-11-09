import { describe, expect, it } from "vitest";
import { createExitQueue } from "./exitQueue";
import { phaseEventFor, phaseReducer, type PhaseEvent, type PhaseState } from "./phase";
import { offerAgainst } from "./phaseProjection";

const at = (phase: PhaseState["phase"], tab: PhaseState["tab"] = "matches"): PhaseState => ({ phase, tab });

describe("offerAgainst", () => {
  it("reports an event the reducer would ignore as changing nothing", () => {
    expect(offerAgainst(at("join"), { type: "startOver" }).changes).toBe(false);
    expect(offerAgainst(at("join"), { type: "buildFailed" }).changes).toBe(false);
    expect(offerAgainst(at("opener"), { type: "build" }).changes).toBe(false);
  });

  it("reports a real change and the state after it", () => {
    const offer = offerAgainst(at("building"), { type: "buildFailed" });
    expect(offer.changes).toBe(true);
    expect(offer.next.phase).toBe("join");
  });

  it("treats a Start over from network as a change", () => {
    const offer = offerAgainst(at("network", "brief"), { type: "startOver" });
    expect(offer.changes).toBe(true);
    expect(offer.next).toEqual(at("join", "matches"));
  });

  it("ends on join after a fast match during the join exit, then Start over", () => {
    // Pick (build queued), the match lands (ready, no event), the still-mounted card's Start over resets to join.
    const events: PhaseEvent[] = [{ type: "build" }];
    const reset = phaseEventFor("ready", "join");
    expect(reset).toEqual({ type: "buildFailed" });
    events.push(reset!);
    let projected = at("join");
    const accepted: PhaseEvent[] = [];
    for (const event of events) {
      const offer = offerAgainst(projected, event);
      projected = offer.next;
      if (offer.changes) accepted.push(event);
    }
    expect(accepted).toEqual([{ type: "build" }, { type: "buildFailed" }]);
    expect(projected.phase).toBe("join");
  });

  it("drops the buildFailed that follows a Start over already applied", () => {
    // Start over from network lands on join; the reset then reports ready to join.
    let projected = at("network");
    projected = offerAgainst(projected, { type: "startOver" }).next;
    expect(offerAgainst(projected, phaseEventFor("ready", "join")!).changes).toBe(false);
  });

  it("applies nothing extra when a queue drains a dropped event", async () => {
    const applied: PhaseEvent[] = [];
    const queue = createExitQueue<PhaseEvent>((e) => applied.push(e));
    let projected = at("join");
    for (const event of [{ type: "build" } as const, { type: "buildFailed" } as const, { type: "startOver" } as const]) {
      const offer = offerAgainst(projected, event);
      projected = offer.next;
      queue.offer(event, offer.changes ? () => Promise.resolve() : null);
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(applied.reduce(phaseReducer, at("join")).phase).toBe("join");
  });
});
