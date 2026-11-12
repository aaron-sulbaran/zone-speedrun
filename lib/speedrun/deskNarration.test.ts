import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import { rivalById } from "./deskSamples";
import { capitalizeFirst, deskFirstName, deskFit, narrationLine } from "./deskNarration";
import type { IntroRequest } from "./introRequest";
import type { Match } from "./match";
import { matchKey } from "./matchList";

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
    expect(narrationLine("notNow", null, "Sam")).toBe(speedrunCopy.team.beats.notNowFree("Sam"));
    expect(narrationLine("notNow", "requested", "Sam")).toBe(speedrunCopy.team.beats.notNow("Sam"));
    expect(narrationLine("sentInstead", null, "Sam", "Jonah")).toBe(speedrunCopy.team.beats.sentInsteadFree("Jonah", "Sam"));
    expect(narrationLine("sentInstead", "requested", "Sam", "Jonah")).toBe(speedrunCopy.team.beats.sentInstead("Jonah", "Sam"));
    expect(narrationLine("twoWeeks", "connected", "Sam")).toBe(speedrunCopy.team.beats.twoWeeks);
  });
});

describe("desk fit brief", () => {
  const match: Match = { company: { name: "Halcyon Works", slug: "halcyon", logo: null, cohort: null, stage: null, blurb: "blurb" }, role: null, score: 1, reasons: [], connect: ["intro"] };
  const roleMatch: Match = { ...match, role: { title: "Product Engineer" } as Match["role"] };
  const request = (candidate: Partial<IntroRequest["candidate"]>, whyRole: string, forMatch: Match = match): IntroRequest => ({
    candidate: { firstName: "Sam", headline: "", shipped: [], kind: "visitor", ...candidate },
    match: forMatch,
    matchKey: matchKey(forMatch),
    ranked: [matchKey(match)],
    // The candidate-facing line is second person on purpose; the desk must never show it.
    fit: { whyThem: "You asked for product, and they are hiring a Product Manager.", whyRole },
    status: "requested",
    introSent: false,
    passedBy: null,
  });
  // Catches: a desk fit line that reads to the candidate ("You asked for...") instead of about them.
  it("never speaks to the visitor, with or without a project and a why", () => {
    for (const r of [request({ shipped: ["a hiring tracker"] }, "I want to build tools for founders"), request({ firstName: "" }, "")]) {
      for (const line of Object.values(deskFit(r))) {
        expect(line).not.toMatch(/^You/);
        expect(line).not.toMatch(/\byou(r)?\b/i);
      }
    }
  });
  const team = speedrunCopy.team;
  it("names the project when there is one and the intro request when there is not, on the role when the match has one", () => {
    expect(deskFit(request({ shipped: [" a hiring tracker "] }, "", roleMatch)).whyThem).toBe(team.fit.whyThem("Sam", "a hiring tracker", null));
    expect(deskFit(request({}, "", roleMatch)).whyThem).toBe(team.fit.whyThem("Sam", "", null));
  });
  // Catches: a company-only match (no role) told "on this role" in an email that never names a role.
  it("ends on the company when the match has no role", () => {
    const line = deskFit(request({ shipped: ["a hiring tracker"] }, "")).whyThem;
    expect(line).toBe(team.fit.whyThem("Sam", "a hiring tracker", "Halcyon Works"));
    expect(line).not.toBe(team.fit.whyThem("Sam", "a hiring tracker", null));
    expect(line).toContain("Halcyon Works");
    expect(deskFit(request({}, "")).whyThem).toBe(team.fit.whyThem("Sam", "", "Halcyon Works"));
  });
  // Catches: the no-name fallback ("this candidate") opening the fit line in lowercase.
  it("capitalizes the no-name fallback where it opens the line, and nowhere else", () => {
    const noName = request({ firstName: "" }, "", roleMatch);
    expect(deskFit(noName).whyThem).toBe(team.fit.whyThem("This candidate", "", null));
    expect(deskFit(noName).whyThem.startsWith("This candidate")).toBe(true);
    expect(capitalizeFirst("")).toBe("");
    expect(capitalizeFirst("Sam")).toBe("Sam");
  });
  it("quotes the why in their words, and is empty when they gave none", () => {
    expect(deskFit(request({}, " build tools ")).whyRole).toBe('In their words: "build tools"');
    expect(deskFit(request({}, "   ")).whyRole).toBe("");
  });
});
