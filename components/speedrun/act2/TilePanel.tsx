"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { speedrunCopy } from "@/lib/content";
import { settledAction, type Action, type IntroCard } from "@/lib/speedrun/actions";
import { deadlineText, plainNextStep } from "@/lib/speedrun/boardLabels";
import { filterRows, sortRows, TILE_FILTER, type TileKey } from "@/lib/speedrun/board";
import { rowKey } from "@/lib/speedrun/keys";
import { prefersReducedMotion, SR_EASE, SR_STEP_MS } from "@/lib/speedrun/motion";
import { shortDay } from "@/lib/speedrun/when";
import type { AppRow } from "@/lib/speedrun/types";
import { ActionSlot } from "./ActionSlot";
import { SECONDARY } from "./IntroControls";
import { LIST_GRID } from "./listGrid";

const copy = speedrunCopy.board;
const MAX_ITEMS = 6;

type Shared = {
  isDone: (action: Action) => boolean;
  pickedFor: (action: Action) => string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};
type Props = Shared & { tile: TileKey; rows: AppRow[]; actions: Map<string, Action>; intros: IntroCard[] };

function Item({ company, second, status, statusAttr, action }: { company: string; second: ReactNode; status: ReactNode; statusAttr: string; action: ReactNode }) {
  return (
    <li data-tile-item="" data-done-scope="" className={`flex flex-col gap-1 py-3 ${LIST_GRID}`}>
      <p data-tile-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{company}</p>
      {second}
      <p {...{ [statusAttr]: "" }} className="text-sm font-semibold text-sr-ink">{status}</p>
      <div className="lg:justify-self-end">{action}</div>
    </li>
  );
}

function RowItem({ row, action, shared }: { row: AppRow; action: Action | undefined; shared: Shared }) {
  // A row that began with a later email has no application date to show.
  const status = action ? deadlineText(action) : row.appliedAt ? copy.appliedOn(shortDay(row.appliedAt)) : speedrunCopy.board.table.noApplied;
  return (
    <Item
      company={row.company}
      second={<p className="text-sm text-sr-ink2">{row.role ?? copy.table.noRole}</p>}
      status={status}
      statusAttr="data-tile-due"
      action={
        action ? (
          <ActionSlot action={action} slot="tile" label={copy.nextStep[action.kind]} done={shared.isDone(action)} picked={shared.pickedFor(action)} className={SECONDARY} onOpen={shared.onOpen} />
        ) : (
          <p className="text-sm text-sr-ink2">{plainNextStep(row)}</p>
        )
      }
    />
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

  const filter = TILE_FILTER[tile];
  const matching = filter ? filterRows(rows, filter) : [];
  const ordered = tile === "applied" ? [...matching].sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt)) : sortRows(matching, "next", "asc", actions);
  const total = tile === "intros" ? intros.length : ordered.length;
  const shown = ordered.slice(0, MAX_ITEMS);

  return (
    <div ref={ref} id={`sr-tile-${tile}`} data-tile-panel={tile} role="region" aria-label={copy.tilePanels[tile]} className="rounded-2xl border border-sr-soft bg-sr-surface px-4 py-2 lg:px-5">
      {total === 0 ? (
        <p className="py-3 text-sm text-sr-ink2">{copy.tileNone}</p>
      ) : (
        <ul className="divide-y divide-sr-soft">
          {tile === "intros"
            ? intros.slice(0, MAX_ITEMS).map((card) => {
                const settled = settledAction(card, shared.isDone);
                const action = settled ?? card.action;
                return (
                  <Item
                    key={card.company}
                    company={card.company}
                    second={<p data-tile-who="" className="text-sm text-sr-ink2">{copy.needs.who(card.who.name, card.who.title)}</p>}
                    status={copy.introStatus[card.status]}
                    statusAttr="data-tile-status"
                    action={action ? <ActionSlot action={action} slot="tile" label={copy.nextStep[action.kind]} done={!!settled} picked={shared.pickedFor(action)} className={SECONDARY} onOpen={shared.onOpen} /> : null}
                  />
                );
              })
            : shown.map((row) => <RowItem key={rowKey(row)} row={row} action={actions.get(rowKey(row))} shared={shared} />)}
        </ul>
      )}
      {total > MAX_ITEMS && <p className="pb-3 text-sm text-sr-ink2">{tile === "intros" ? copy.listMore(MAX_ITEMS, total) : copy.tileMore(MAX_ITEMS, total)}</p>}
    </div>
  );
}
