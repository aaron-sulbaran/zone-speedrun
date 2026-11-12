import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import { rivalById } from "./deskSamples";
import { deskFirstName, narrationLine } from "./deskNarration";

describe("desk narration", () => {
  it("names a nameless visitor as the candidate, not as you", () => {
    expect(deskFirstName(null)).toBe(speedrunCopy.team.noName);
    expect(deskFirstName("")).toBe(speedrunCopy.team.noName);
    expect(deskFirstName("Sam")).toBe("Sam");
  });
  it("never writes \"you's\" for a nameless visitor", () => {
    const name = deskFirstName(null);
    for (const beat of ["sentInstead", "notNow"] as const) {
      const line = narrationLine(beat, "requested", name);
      expect(line).toContain(name);
      expect(line).not.toMatch(/\byou's/i);
    }
  });
  it("reads the empty queue only when nothing is live and the desk is untouched", () => {
    expect(narrationLine("arrive", null, "Sam")).toBe(speedrunCopy.team.beats.empty);
    expect(narrationLine("arrive", "requested", "Sam")).toBe(speedrunCopy.team.beats.arrive);
    expect(narrationLine("twoWeeks", null, "Sam")).toBe(speedrunCopy.team.beats.twoWeeks);
  });
  it("names the rival whose one-pager went on, and the visitor whose pick is freed", () => {
    const line = narrationLine("sentInstead", "requested", "Sam", "Jonah");
    expect(line).toBe(speedrunCopy.team.beats.sentInstead("Jonah", "Sam"));
    expect(line).toMatch(/^Jonah's one-pager/);
    expect(line).toContain("Sam's pick");
  });
  it("finds a rival by id and knows none for an unknown id", () => {
    expect(rivalById("r-eng-1")?.firstName).toBe("Jonah");
    expect(rivalById("nope")).toBeNull();
    expect(rivalById(null)).toBeNull();
  });
  it("falls back to the arrive or empty line when the live stage no longer fits the beat", () => {
    // A review beat with the request gone (a candidate-side removal) reads as an untouched desk.
    expect(narrationLine("review", null, "Sam")).toBe(speedrunCopy.team.beats.empty);
    expect(narrationLine("review", "requested", "Sam")).toBe(speedrunCopy.team.beats.review);
    expect(narrationLine("review", "withFounder", "Sam")).toBe(speedrunCopy.team.beats.arrive);
    expect(narrationLine("sent", "requested", "Sam")).toBe(speedrunCopy.team.beats.arrive);
    expect(narrationLine("sent", "withFounder", "Sam")).toBe(speedrunCopy.team.beats.sent);
    expect(narrationLine("interested", "connected", "Sam")).toBe(speedrunCopy.team.beats.interested);
    expect(narrationLine("introSent", null, "Sam")).toBe(speedrunCopy.team.beats.empty);
    // These beats are results of the walk, not claims about the live card.
    expect(narrationLine("notNow", null, "Sam")).toBe(speedrunCopy.team.beats.notNow("Sam"));
    expect(narrationLine("twoWeeks", "connected", "Sam")).toBe(speedrunCopy.team.beats.twoWeeks);
  });
});
