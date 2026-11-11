import { describe, expect, it } from "vitest";
import { createRequest, eligible, pass, swapRequest, type IntroRequest } from "./introRequest";
import { matchKey } from "./matchList";
import type { Match } from "./match";
import type { Intake } from "./types";

function match(name: string, connect: Match["connect"], reason?: string): Match {
  return {
    company: { name, slug: name.toLowerCase(), logo: null, cohort: null, stage: null, blurb: `${name} blurb` },
    role: null,
    score: 1,
    reasons: reason ? [{ text: reason, cites: ["title"] }] : [],
    connect,
  };
}

const INTAKE: Intake = { targets: ["product"], places: [], why: "I want a small team." };
const CANDIDATE: IntroRequest["candidate"] = { firstName: "Alex", headline: "PM", shipped: ["a thing"], kind: "visitor" };
const A = match("A", ["intro", "apply"], "Because of A");
const B = match("B", ["apply"]);
const C = match("C", ["intro"]);
const D = match("D", ["intro"]);

describe("createRequest", () => {
  it("refuses a first pick that cannot take an intro", () => {
    expect(eligible(B)).toBe(false);
    expect(createRequest({ candidate: CANDIDATE, shortlist: [B, A], intake: INTAKE })).toBeNull();
    expect(createRequest({ candidate: CANDIDATE, shortlist: [], intake: INTAKE })).toBeNull();
  });

  it("puts the request's key first in ranked and fills the fit", () => {
    const request = createRequest({ candidate: CANDIDATE, shortlist: [A, B, C], intake: INTAKE });
    expect(request?.matchKey).toBe(matchKey(A));
    expect(request?.ranked).toEqual([matchKey(A), matchKey(B), matchKey(C)]);
    expect(request?.fit).toEqual({ whyThem: "Because of A", whyRole: "I want a small team." });
    expect(request).toMatchObject({ status: "requested", introSent: false, passedBy: null });
  });

  it("falls back to the blurb and an empty whyRole", () => {
    const request = createRequest({ candidate: CANDIDATE, shortlist: [C], intake: { ...INTAKE, why: "  " } });
    expect(request?.fit).toEqual({ whyThem: "C blurb", whyRole: "" });
  });
});

describe("swapRequest", () => {
  const base = createRequest({ candidate: CANDIDATE, shortlist: [A, B, C], intake: INTAKE }) as IntroRequest;

  it("moves the request to another eligible match and ranks it first", () => {
    const swapped = swapRequest(base, C, [A, B, C], INTAKE);
    expect(swapped?.matchKey).toBe(matchKey(C));
    expect(swapped?.ranked[0]).toBe(matchKey(C));
  });

  it("returns null once the founder has it, or for an ineligible target", () => {
    expect(swapRequest({ ...base, status: "withFounder" }, C, [A, B, C], INTAKE)).toBeNull();
    expect(swapRequest(base, B, [A, B, C], INTAKE)).toBeNull();
  });

  it("returns null for a match outside the shortlist", () => {
    expect(swapRequest(base, D, [A, B, C], INTAKE)).toBeNull();
  });
});

describe("pass", () => {
  it("makes the next eligible match in ranked live at requested", () => {
    const request = createRequest({ candidate: CANDIDATE, shortlist: [A, B, C], intake: INTAKE }) as IntroRequest;
    const { passed, live } = pass(request, "team", [A, B, C], INTAKE);
    expect(passed).toMatchObject({ status: "passed", passedBy: "team", matchKey: matchKey(A) });
    expect(live).toMatchObject({ status: "requested", matchKey: matchKey(C), introSent: false, passedBy: null });
    expect(live?.ranked).toEqual([matchKey(C)]);
  });

  it("returns live: null when nothing eligible is left", () => {
    const request = createRequest({ candidate: CANDIDATE, shortlist: [A, B], intake: INTAKE }) as IntroRequest;
    expect(pass(request, "founder", [A, B], INTAKE).live).toBeNull();
  });
});
