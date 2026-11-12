"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DemoAction } from "@/lib/speedrun/demoState";
import { isLive, type IntroRequest } from "@/lib/speedrun/introRequest";
import type { Match } from "@/lib/speedrun/match";
import { matchKey } from "@/lib/speedrun/matchList";

const copy = speedrunCopy.board.shortlist;
const board = speedrunCopy.board;
const MOVE = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-sr-soft text-sr-ink hover:bg-sr-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple disabled:cursor-not-allowed disabled:opacity-40";
const LINK = "inline-flex min-h-11 items-center rounded-full px-1 font-semibold text-sr-ink underline underline-offset-4 hover:text-sr-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";
const CHIP = "inline-block whitespace-nowrap rounded-md border border-sr-soft bg-sr-surface px-2 py-0.5 font-srcond text-[11px] uppercase tracking-wider text-sr-ink";

type Props = {
  keys: string[];
  matches: Match[];
  request: IntroRequest | null;
  dispatch: Dispatch<DemoAction>;
  onMatches: () => void;
};

/** The picks from Matches in rank order, with the intro request's status on the match that holds it. */
export function Shortlist({ keys, matches, request, dispatch, onMatches }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef<{ key: string; direction: -1 | 1 } | null>(null);
  // A moved item changes place in the list; its button follows it, or the other one when it has reached an end.
  useEffect(() => {
    const target = moved.current;
    if (!target) return;
    moved.current = null;
    const item = [...(root.current?.querySelectorAll<HTMLElement>("[data-shortlist-item]") ?? [])].find((node) => node.dataset.shortlistItem === target.key);
    const wanted = item?.querySelector<HTMLButtonElement>(target.direction < 0 ? "[data-shortlist-up]" : "[data-shortlist-down]");
    const other = item?.querySelector<HTMLButtonElement>(target.direction < 0 ? "[data-shortlist-down]" : "[data-shortlist-up]");
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [keys]);

  const byKey = new Map(matches.map((match) => [matchKey(match), match]));
  const items = keys.flatMap((key) => (byKey.has(key) ? [{ key, match: byKey.get(key) as Match }] : []));
  if (items.length === 0) {
    return (
      <p data-shortlist-empty="" className="text-base text-sr-ink">
        {copy.empty.before}
        <button type="button" onClick={onMatches} className={LINK}>{copy.empty.link}</button>
        {copy.empty.after}
      </p>
    );
  }
  const move = (key: string, direction: -1 | 1) => {
    moved.current = { key, direction };
    dispatch({ type: "moveShortlist", key, direction });
  };
  const live = isLive(request) ? request : null;
  return (
    <div ref={root}>
      <ol className="divide-y divide-sr-soft">
        {items.map(({ key, match }, at) => (
          <li key={key} data-shortlist-item={key} className="flex items-center gap-3 py-3">
            <span data-shortlist-position="" className="w-8 shrink-0 font-srcond text-sm uppercase tracking-wider text-sr-ink2">{copy.rank(at + 1)}</span>
            <div className="min-w-0 flex-1">
              <p data-shortlist-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{match.company.name}</p>
              <p className="break-words text-sm text-sr-ink2">{match.role?.title ?? speedrunCopy.matches.companyOnly}</p>
              {live?.matchKey === key && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span data-shortlist-status="" className={CHIP}>{board.introStatus[live.status]}</span>
                  {live.status === "requested" && <span className="text-sm text-sr-ink2">{copy.requestNote}</span>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" data-shortlist-up="" disabled={at === 0} aria-label={copy.moveUp(match.company.name)} onClick={() => move(key, -1)} className={MOVE}>
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button type="button" data-shortlist-down="" disabled={at === items.length - 1} aria-label={copy.moveDown(match.company.name)} onClick={() => move(key, 1)} className={MOVE}>
                <ArrowDown aria-hidden="true" size={16} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" data-shortlist-matches="" onClick={onMatches} className={`mt-2 ${LINK}`}>{copy.toMatches}</button>
    </div>
  );
}
