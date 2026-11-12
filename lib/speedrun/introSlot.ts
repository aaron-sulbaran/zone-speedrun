import { eligible, type IntroRequest } from "./introRequest";
import type { Match } from "./match";
import { matchKey } from "./matchList";

/** What one match's detail shows for the single intro request (Rulings 44 and P1). */
export type IntroSlot =
  | { kind: "here" }
  | { kind: "elsewhere"; company: string; canSwap: boolean }
  | { kind: "request"; enabled: boolean; hint: { reason: "bring" } | { reason: "first"; rank: number } | { reason: "noPath" } | null };

/** A passed request is no longer live; the next one (PR 7) arrives as a new request. */
export const liveRequest = (request: IntroRequest | null): IntroRequest | null => (request && request.status !== "passed" ? request : null);

export function introSlot(match: Match, shortlist: string[], request: IntroRequest | null): IntroSlot {
  const key = matchKey(match);
  const live = liveRequest(request);
  if (live) {
    if (live.matchKey === key) return { kind: "here" };
    return { kind: "elsewhere", company: live.match.company.name, canSwap: live.status === "requested" && eligible(match) && shortlist.includes(key) };
  }
  const at = shortlist.indexOf(key);
  if (at < 0) return { kind: "request", enabled: false, hint: { reason: "bring" } };
  if (at > 0) return { kind: "request", enabled: false, hint: { reason: "first", rank: at + 1 } };
  if (!eligible(match)) return { kind: "request", enabled: false, hint: { reason: "noPath" } };
  return { kind: "request", enabled: true, hint: null };
}
