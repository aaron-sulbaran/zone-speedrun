import { eligible, isLive, type IntroRequest } from "./introRequest";
import type { Match } from "./match";
import { matchKey } from "./matchList";

/** What one match's detail shows for the single intro request (Rulings 44 and P1). */
export type IntroSlot =
  | { kind: "here" }
  | { kind: "elsewhere"; company: string; canSwap: boolean }
  /** No intro path: no button, only the line. */
  | { kind: "noPath" }
  | { kind: "request"; enabled: boolean; hint: { reason: "bring" } | { reason: "first"; rank: number } | { reason: "leadNoPath" } | null };

/** `leadHasPath` is whether the shortlist's #1 can take an intro; a #1 that cannot leaves every other pick with no way to request one. */
export function introSlot(match: Match, shortlist: string[], request: IntroRequest | null, leadHasPath = true): IntroSlot {
  const key = matchKey(match);
  if (isLive(request)) {
    if (request.matchKey === key) return { kind: "here" };
    return { kind: "elsewhere", company: request.match.company.name, canSwap: request.status === "requested" && eligible(match) && shortlist.includes(key) };
  }
  if (!eligible(match)) return { kind: "noPath" };
  const at = shortlist.indexOf(key);
  if (at < 0) return { kind: "request", enabled: false, hint: { reason: "bring" } };
  if (at > 0 && !leadHasPath) return { kind: "request", enabled: false, hint: { reason: "leadNoPath" } };
  if (at > 0) return { kind: "request", enabled: false, hint: { reason: "first", rank: at + 1 } };
  return { kind: "request", enabled: true, hint: null };
}
