"use client";

import { ChevronRight } from "lucide-react";
import { forwardRef, type KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import { reasonLine, type ListItem } from "@/lib/speedrun/matchList";
import { CompanyLogo } from "./MatchCard";
import { RowBringForward } from "./IntroControls";
import { NEXT_LINK, NextArrow } from "./NetworkTabs";

const copy = speedrunCopy.matches;
const CHIP = "rounded-full bg-sr-hud px-2 py-0.5 font-srcond text-[11px] uppercase tracking-wider text-sr-ink2";

type MatchListProps = {
  items: ListItem[];
  selectedKey: string | null;
  name: string | null;
  matchCount: number;
  mentionedFounding: boolean;
  onSelect: (key: string) => void;
  onMove: (direction: "up" | "down", fromRow: boolean) => void;
  inert: boolean;
  nextLabel: string;
  onNext: () => void;
  registerRow: (key: string, node: HTMLButtonElement | null) => void;
  rankOf: (key: string) => number | null;
  lockedOf: (key: string) => boolean;
  onBring: (key: string, on: boolean) => void;
};

function RowBody({ item, mentionedFounding }: { item: ListItem; mentionedFounding: boolean }) {
  if (item.kind === "founder") {
    return (
      <>
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sr-purple font-srcond text-lg uppercase text-sr-surface">
          {copy.founderRow.charAt(0)}
        </span>
        <span className="min-w-0">
          <span data-row-company="" className="block break-words font-semibold leading-tight">
            {copy.founderRow}
          </span>
          <span className="mt-1 block break-words text-sm text-sr-ink2">{mentionedFounding ? copy.founder.mentioned : copy.founder.heading}</span>
        </span>
      </>
    );
  }
  const { company, role } = item.match;
  return (
    <>
      <CompanyLogo name={company.name} logo={company.logo} />
      <span className="min-w-0">
        <span data-row-company="" className="block break-words font-semibold leading-tight">
          {company.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {role ? <span className="break-words text-sm font-medium">{role.title}</span> : <span className={CHIP}>{copy.companyOnly}</span>}
        </span>
        <span className="mt-1 block break-words text-sm text-sr-ink2">{reasonLine(item.match)}</span>
      </span>
    </>
  );
}

// The rows are plain buttons: Up and Down move the selection and the focus with it, so focus never leaves the list.
export const MatchList = forwardRef<HTMLDivElement, MatchListProps>(function MatchList(
  { items, selectedKey, name, matchCount, mentionedFounding, onSelect, onMove, registerRow, inert, nextLabel, onNext, rankOf, lockedOf, onBring },
  ref,
) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const target = event.target as HTMLElement;
    const fromRow = target.closest("[data-match-row]") !== null;
    // Only rows and the heading take part; the Next button and anything else keep their own Up and Down.
    if (!fromRow && target.id !== "sr-matches-heading") return;
    event.preventDefault();
    // From the heading (not a row) the first press lands on the selected row instead of skipping past it.
    onMove(event.key === "ArrowUp" ? "up" : "down", fromRow);
  };
  return (
    <div ref={ref} data-match-list="" inert={inert} onKeyDown={onKeyDown} className="h-full overflow-y-auto overscroll-contain lg:w-[380px] lg:shrink-0 lg:pr-3">
      <h2 id="sr-matches-heading" data-phase-heading="" tabIndex={-1} className="break-words font-srcond text-sm uppercase tracking-widest text-sr-purple focus:outline-none">
        {copy.listHeading(name)}
      </h2>
      {matchCount > 0 && (
        <p data-matches-count="" className="mt-1 text-sm text-sr-ink2">
          {copy.listCount(matchCount)}
        </p>
      )}
      <ul aria-labelledby="sr-matches-heading" className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="relative">
            <button
              ref={(node) => registerRow(item.key, node)}
              type="button"
              data-match-row={item.key}
              aria-current={item.key === selectedKey ? "true" : undefined}
              onClick={() => onSelect(item.key)}
              className="flex w-full items-start gap-3 rounded-xl border border-sr-soft bg-sr-surface p-3 pr-14 text-left transition-colors duration-200 hover:bg-sr-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sr-purple lg:bg-sr-hud lg:hover:bg-sr-strong aria-[current=true]:border-sr-ink lg:aria-[current=true]:bg-sr-surface motion-reduce:transition-none"
            >
              <RowBody item={item} mentionedFounding={mentionedFounding} />
              <ChevronRight aria-hidden="true" size={18} className="absolute right-3 top-3 h-[18px] w-[18px] text-sr-ink2" />
            </button>
            {item.kind === "match" && <RowBringForward company={item.match.company.name} rank={rankOf(item.key)} locked={lockedOf(item.key)} onChange={(on) => onBring(item.key, on)} />}
          </li>
        ))}
      </ul>
      {matchCount === 0 && (
        <p data-matches-empty="" className="mt-4 rounded-xl border border-sr-soft bg-sr-surface p-4 text-sm text-sr-ink2">
          {copy.empty}
        </p>
      )}
      <div className="mt-8 pb-4">
        <button type="button" onClick={onNext} className={`${NEXT_LINK} focus-visible:ring-inset`}>
          {nextLabel}
          <NextArrow />
        </button>
      </div>
    </div>
  );
});

