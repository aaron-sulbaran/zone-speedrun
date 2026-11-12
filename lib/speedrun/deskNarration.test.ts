import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
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
});
