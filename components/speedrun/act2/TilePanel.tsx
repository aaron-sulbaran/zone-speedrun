"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { speedrunCopy } from "@/lib/content";
import type { Action, IntroCard } from "@/lib/speedrun/actions";
import { filterRows, sortRows, TILE_FILTER, type TileKey } from "@/lib/speedrun/board";
import { rowKey } from "@/lib/speedrun/keys";
import { prefersReducedMotion, SR_EASE, SR_STEP_MS } from "@/lib/speedrun/motion";
import { shortDay } from "@/lib/speedrun/when";
import type { AppRow } from "@/lib/speedrun/types";
import { ActionSlot } from "./ActionSlot";
import { deadlineText, plainNextStep } from "./boardLabels";
import { SECONDARY } from "./IntroControls";

const copy = speedrunCopy.board;
const MAX_ITEMS = 6;

type Shared = {
  isDone: (action: Action) => boolean;
  pickedFor: (action: Action) => string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};
type Props = Shared & { tile: TileKey; rows: AppRow[]; actions: Map<string, Action>; intros: IntroCard[] };

function Item({ company, children }: { company: string; children: ReactNode }) {
  return (
    <li data-tile-item="" data-done-scope="" className="flex flex-col gap-1 py-3 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_9rem_auto] md:items-center md:gap-4">
      <p data-tile-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{company}</p>
      {children}
    </li>
  );
}

function RowItem({ row, action, shared }: { row: AppRow; action: Action | undefined; shared: Shared }) {
  return (
    <Item company={row.company}>
      <p className="text-sm text-sr-ink2">{row.role ?? copy.table.noRole}</p>
      <p data-tile-due="" className="text-sm font-semibold text-sr-ink">{action ? deadlineText(action) : copy.appliedOn(shortDay(row.appliedAt ?? row.lastEventAt))}</p>
      {action ? (
        <ActionSlot action={action} slot="tile" label={copy.nextStep[action.kind]} done={shared.isDone(action)} picked={shared.pickedFor(action)} className={SECONDARY} onOpen={shared.onOpen} />
      ) : (
        <p className="text-sm text-sr-ink2">{plainNextStep(row)}</p>
      )}
    </Item>
  );
}

/** The list a tile opens: its companies, each with a deadline and a next step. */
export function TilePanel({ tile, rows, actions, intros, ...shared }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // A short fade in. Under reduced motion it opens with none.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    ref.current?.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: SR_STEP_MS, easing: SR_EASE });
  }, []);

  const matching = filterRows(rows, TILE_FILTER[tile]);
  const ordered = tile === "applied" ? [...matching].sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt)) : sortRows(matching, "next", "asc", actions);
  const total = tile === "intros" ? intros.length : ordered.length;
  const shown = ordered.slice(0, MAX_ITEMS);

  return (
    <div ref={ref} id={`sr-tile-${tile}`} data-tile-panel={tile} role="region" aria-label={copy.tilePanels[tile]} className="rounded-2xl border border-sr-soft bg-sr-surface px-4 py-2 md:px-5">
      {total === 0 ? (
        <p className="py-3 text-sm text-sr-ink2">{copy.tileNone}</p>
      ) : (
        <ul className="divide-y divide-sr-soft">
          {tile === "intros"
            ? intros.slice(0, MAX_ITEMS).map((card) => (
                <Item key={card.company} company={card.company}>
                  <p data-tile-who="" className="text-sm text-sr-ink2">{speedrunCopy.board.needs.who(card.who.name, card.who.title)}</p>
                  <p data-tile-status="" className="text-sm font-semibold text-sr-ink">{copy.introStatus[card.status]}</p>
                  {card.action ? (
                    <ActionSlot action={card.action} slot="tile" label={copy.nextStep[card.action.kind]} done={shared.isDone(card.action)} picked={shared.pickedFor(card.action)} className={SECONDARY} onOpen={shared.onOpen} />
                  ) : (
                    <span />
                  )}
                </Item>
              ))
            : shown.map((row) => <RowItem key={rowKey(row)} row={row} action={actions.get(rowKey(row))} shared={shared} />)}
        </ul>
      )}
      {total > MAX_ITEMS && <p className="pb-3 text-sm text-sr-ink2">{copy.tileMore(MAX_ITEMS, total)}</p>}
    </div>
  );
}
