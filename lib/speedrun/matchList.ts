import { roleMatchKey } from "./keys";
import type { Match, MatchResult } from "./match";

export type ListItem = { key: string; kind: "founder" } | { key: string; kind: "match"; match: Match };

export const FOUNDER_KEY = "founder";

export const matchKey = (match: Match): string => roleMatchKey(match.company.name, match.role?.id ?? null);

/** The founder route leads the list when there is one, then one item per match. */
export function listItems(result: MatchResult): ListItem[] {
  const founder: ListItem[] = result.routes.length > 0 ? [{ key: FOUNDER_KEY, kind: "founder" }] : [];
  return [...founder, ...result.matches.map((match): ListItem => ({ key: matchKey(match), kind: "match", match }))];
}

/** Arrow-key selection: clamps at both ends, an unknown or null current lands on the first key, an empty list on null. */
export function moveSelection(items: ListItem[], current: string | null, direction: "up" | "down"): string | null {
  if (items.length === 0) return null;
  const at = items.findIndex((item) => item.key === current);
  if (at === -1) return items[0].key;
  const next = Math.min(items.length - 1, Math.max(0, at + (direction === "down" ? 1 : -1)));
  return items[next].key;
}

export const reasonLine = (match: Match): string => match.reasons[0]?.text ?? match.company.blurb;
