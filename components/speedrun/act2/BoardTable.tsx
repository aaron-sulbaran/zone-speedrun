"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import { BOARD_FILTERS, filterRows, sortRows, type BoardFilter, type SortKey } from "@/lib/speedrun/board";
import { rowKey } from "@/lib/speedrun/keys";
import type { AppRow } from "@/lib/speedrun/types";
import { BoardTableRow } from "./BoardTableRow";

const DEFAULT_ROWS = 8;
const COLUMNS: SortKey[] = ["company", "role", "stage", "applied", "lastUpdate", "next"];
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

type Props = {
  rows: AppRow[];
  filter: BoardFilter;
  onFilter: (filter: BoardFilter) => void;
  actions: Map<string, Action>;
  isDone: (action: Action) => boolean;
  pickedFor: (action: Action) => string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};

export function BoardTable({ rows, filter, onFilter, actions, isDone, pickedFor, onOpen }: Props) {
  const copy = speedrunCopy.board.table;
  const [showAll, setShowAll] = useState(false);
  // The default is the soonest deadline first (Ruling 50).
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "next", dir: "asc" });
  const ordered = useMemo(() => sortRows(filterRows(rows, filter), sort.key, sort.dir, actions), [rows, filter, sort, actions]);
  const shown = showAll ? ordered : ordered.slice(0, DEFAULT_ROWS);
  const head = "px-1 py-1 text-left font-srcond text-xs font-normal uppercase tracking-widest text-sr-ink2";

  return (
    <div data-board-table="">
      <div role="group" aria-label={copy.filtersLabel} className="mb-3 flex flex-wrap gap-2">
        {BOARD_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            data-filter={key}
            aria-pressed={filter === key}
            onClick={() => onFilter(key)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${FOCUS} ${filter === key ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink hover:bg-sr-strong"}`}
          >
            {copy.filters[key]}
          </button>
        ))}
      </div>
      <div data-table-scroll="" className="overflow-x-auto rounded-2xl border border-sr-soft bg-sr-surface">
        <table className="w-full min-w-[58rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-sr-soft">
              {COLUMNS.map((key) => {
                const active = sort.key === key;
                return (
                  <th key={key} scope="col" data-col={key} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={head}>
                    <button
                      type="button"
                      onClick={() => setSort(active ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })}
                      className={`inline-flex min-h-11 min-w-11 items-center gap-1 rounded-full px-2 uppercase tracking-widest hover:text-sr-ink ${FOCUS} ${active ? "text-sr-ink" : ""}`}
                    >
                      {copy.headers[key]}
                      {active && (sort.dir === "asc" ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-4 text-sr-ink2">{copy.noRows}</td>
              </tr>
            ) : (
              shown.map((row) => {
                const action = actions.get(rowKey(row));
                return <BoardTableRow key={rowKey(row)} row={row} action={action} done={!!action && isDone(action)} picked={action ? pickedFor(action) : undefined} onOpen={onOpen} />;
              })
            )}
          </tbody>
        </table>
      </div>
      {ordered.length > DEFAULT_ROWS && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((now) => !now)}
          className={`mt-3 inline-flex min-h-11 min-w-11 items-center rounded-full px-4 font-srcond text-xs uppercase tracking-wider text-sr-ink2 underline underline-offset-4 hover:text-sr-ink ${FOCUS}`}
        >
          {showAll ? copy.showFewer : copy.showAll(ordered.length)}
        </button>
      )}
    </div>
  );
}
