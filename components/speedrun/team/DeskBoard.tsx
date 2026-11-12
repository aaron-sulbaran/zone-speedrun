"use client";

import { useLayoutEffect, useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DeskCard as Card } from "@/lib/speedrun/desk";
import type { DeskStage } from "@/lib/speedrun/deskSamples";
import { SECONDARY } from "../act2/IntroControls";
import { DeskCard } from "./DeskCard";

const copy = speedrunCopy.team;
export const STAGE_ORDER: DeskStage[] = ["requested", "withFounder", "connected", "tracking", "outcome"];

type Props = {
  columns: Record<DeskStage, Card[]>;
  /** The stage the phone shows. */
  selected: DeskStage;
  /** True when no request is live: Requested starts with the nudge card. */
  nudge: boolean;
  onSelect: (stage: DeskStage) => void;
  onReview: () => void;
  onOpenFounder: () => void;
  onOpenIntro: () => void;
  introSent: boolean;
  onMatches: () => void;
  onTwoWeeks: () => void;
};

// One component tree: five columns from md; below md a strip of five pills picks the one column shown (Ruling 73).
export function DeskBoard({ columns, selected, nudge, introSent, onSelect, onReview, onOpenFounder, onOpenIntro, onMatches, onTwoWeeks }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  // The strip scrolls inside itself when the labels do not fit; the selected pill is brought fully into its box (the page never scrolls).
  useLayoutEffect(() => {
    const box = strip.current;
    const pill = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !pill) return;
    const left = pill.offsetLeft;
    const right = left + pill.offsetWidth;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth;
  }, [selected]);
  return (
    <div>
      <div ref={strip} data-stage-strip="" role="group" aria-label={copy.stagesLabel} className="relative mb-3 flex gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={stage === selected}
            onClick={() => onSelect(stage)}
            className="flex min-h-11 min-w-11 shrink-0 grow flex-col items-center justify-center whitespace-nowrap rounded-lg border border-sr-soft px-3 font-srcond text-[10px] uppercase leading-tight tracking-wider text-sr-ink2 transition-colors duration-200 hover:bg-sr-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple aria-pressed:border-sr-ink aria-pressed:bg-sr-ink aria-pressed:text-sr-surface motion-reduce:transition-none"
          >
            <span>{copy.stages[stage]}</span>
            <span data-stage-count="" className="text-xs">
              {columns[stage].length}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {STAGE_ORDER.map((stage) => (
          <section
            key={stage}
            data-desk-column={stage}
            data-count={columns[stage].length}
            aria-label={copy.columnLabel(copy.stages[stage], columns[stage].length)}
            className={`min-w-0 space-y-2 ${stage === selected ? "" : "max-md:hidden"}`}
          >
            <h3 aria-hidden="true" className="hidden items-center justify-between font-srcond text-xs uppercase tracking-widest text-sr-ink2 md:flex">
              <span className="truncate">{copy.stages[stage]}</span>
              <span>{columns[stage].length}</span>
            </h3>
            {stage === "requested" && nudge && (
              <div data-desk-nudge="" className="rounded-xl border border-dashed border-sr-strong bg-sr-surface p-3">
                <p className="text-sm leading-relaxed text-sr-ink">{copy.nudge}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={onMatches} className={SECONDARY}>
                    {copy.nudgeButton}
                  </button>
                  <button type="button" onClick={onTwoWeeks} className={SECONDARY}>
                    {copy.twoWeeks}
                  </button>
                </div>
              </div>
            )}
            {columns[stage].map((card) => (
              <DeskCard key={card.id} card={card} stage={stage} introSent={introSent} onReview={onReview} onOpenFounder={onOpenFounder} onOpenIntro={onOpenIntro} onTwoWeeks={onTwoWeeks} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
