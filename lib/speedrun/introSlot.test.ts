import { describe, expect, it } from "vitest";
import { createRequest } from "./introRequest";
import { introSlot } from "./introSlot";
import type { Match } from "./match";
import { matchKey } from "./matchList";
import type { Intake } from "./types";

function match(name: string, connect: Match["connect"]): Match {
  return { company: { name, slug: name.toLowerCase(), logo: null, cohort: null, stage: null, blurb: "" }, role: null, score: 1, reasons: [], connect };
}
const A = match("A", ["intro"]);
const B = match("B", ["intro"]);
const C = match("C", ["apply"]);
const keys = (...list: Match[]) => list.map(matchKey);
const intake: Intake = { targets: [], places: [], why: "" };
const requestOn = (list: Match[]) => createRequest({ candidate: { firstName: "Al", headline: "", shipped: [], kind: "visitor" }, shortlist: list, intake });

describe("introSlot", () => {
  it("waits for the shortlist first, then for #1, then for a path", () => {
    expect(introSlot(A, [], null)).toEqual({ kind: "request", enabled: false, hint: { reason: "bring" } });
    expect(introSlot(B, keys(A, B), null)).toEqual({ kind: "request", enabled: false, hint: { reason: "first", rank: 2 } });
    expect(introSlot(C, keys(C), null)).toEqual({ kind: "request", enabled: false, hint: { reason: "noPath" } });
    expect(introSlot(A, keys(A, B), null)).toEqual({ kind: "request", enabled: true, hint: null });
  });

  it("shows the line on every other match, and a swap only on a brought-forward eligible one", () => {
    const request = requestOn([A, B, C])!;
    expect(introSlot(A, keys(A, B, C), request)).toEqual({ kind: "here" });
    expect(introSlot(B, keys(A, B, C), request)).toEqual({ kind: "elsewhere", company: "A", canSwap: true });
    expect(introSlot(C, keys(A, B, C), request)).toEqual({ kind: "elsewhere", company: "A", canSwap: false });
    expect(introSlot(B, keys(A), request)).toEqual({ kind: "elsewhere", company: "A", canSwap: false });
  });

  it("locks the swap once the request has moved on, and treats a passed request as none", () => {
    const request = requestOn([A, B])!;
    expect(introSlot(B, keys(A, B), { ...request, status: "withFounder" })).toMatchObject({ kind: "elsewhere", canSwap: false });
    expect(introSlot(A, keys(A, B), { ...request, status: "passed", passedBy: "team" })).toMatchObject({ kind: "request", enabled: true });
  });
});
