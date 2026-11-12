import type { Match } from "./match";
import { matchKey } from "./matchList";
import type { Intake } from "./types";

export type IntroStatus = "requested" | "withFounder" | "connected" | "passed";

export type IntroRequest = {
  candidate: { firstName: string; headline: string; shipped: string[]; kind: "visitor" | "sample" };
  match: Match;
  matchKey: string;
  /** matchKeys, the request's first. */
  ranked: string[];
  fit: { whyThem: string; whyRole: string };
  status: IntroStatus;
  introSent: boolean;
  passedBy: "team" | "founder" | null;
};

/** At most one request is live; a passed one stays stored but blocks nothing. */
export const isLive = (request: IntroRequest | null): request is IntroRequest => request !== null && request.status !== "passed";

export const eligible = (match: Match): boolean => match.connect.includes("intro");

function build(candidate: IntroRequest["candidate"], match: Match, ranked: string[], intake: Intake): IntroRequest {
  return {
    candidate,
    match,
    matchKey: matchKey(match),
    ranked,
    fit: { whyThem: match.reasons[0]?.text ?? match.company.blurb, whyRole: intake.why.trim() },
    status: "requested",
    introSent: false,
    passedBy: null,
  };
}

/** The request is for the shortlist's first match only. */
export function createRequest(input: { candidate: IntroRequest["candidate"]; shortlist: Match[]; intake: Intake }): IntroRequest | null {
  const [first] = input.shortlist;
  if (!first || !eligible(first)) return null;
  return build(input.candidate, first, input.shortlist.map(matchKey), input.intake);
}

export function swapRequest(request: IntroRequest, to: Match, shortlist: Match[], intake: Intake): IntroRequest | null {
  const key = matchKey(to);
  if (request.status !== "requested" || !eligible(to) || !shortlist.some((m) => matchKey(m) === key)) return null;
  return build(request.candidate, to, [key, ...request.ranked.filter((other) => other !== key)], intake);
}

/** A pass hands the request to the next eligible match after it in `ranked`, if any. */
export function pass(
  request: IntroRequest,
  by: "team" | "founder",
  shortlist: Match[],
  intake: Intake,
): { passed: IntroRequest; live: IntroRequest | null } {
  const passed: IntroRequest = { ...request, status: "passed", passedBy: by };
  const byKey = new Map(shortlist.map((m) => [matchKey(m), m]));
  const at = request.ranked.indexOf(request.matchKey);
  for (let i = at + 1; i < request.ranked.length; i++) {
    const next = byKey.get(request.ranked[i]);
    if (next && eligible(next)) return { passed, live: build(request.candidate, next, request.ranked.slice(i), intake) };
  }
  return { passed, live: null };
}
