"use client";

import { useState } from "react";
import { speedrunCopy } from "@/lib/content";
import { tableRows } from "@/lib/speedrun/board";
import type { AppRow } from "@/lib/speedrun/types";

const DEFAULT_ROWS = 8;
const CHIP = "inline-block whitespace-nowrap rounded-full px-2.5 py-1 font-srcond text-[11px] uppercase tracking-wider";

function stageLabel(row: AppRow) {
  const { stages, exits } = speedrunCopy.flow;
  if (row.exit === "rejected") return exits.rejected;
  if (row.exit === "noreply") return exits.noreply;
  return stages[row.furthest];
}

function nextStep(row: AppRow) {
  const copy = speedrunCopy.board.table;
  if (row.exit === "rejected") return copy.closed;
  if (row.exit === "noreply") return copy.quiet;
  return row.next ?? copy.closed;
}

export function BoardTable({ rows }: { rows: AppRow[] }) {
  const copy = speedrunCopy.board.table;
  const [showAll, setShowAll] = useState(false);
  const { shown, total } = tableRows(rows, showAll, DEFAULT_ROWS);
  const head = "px-3 py-2 text-left font-srcond text-xs font-normal uppercase tracking-widest text-sr-ink2";
  return (
    <div data-board-table="">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-sr-soft">
            <th scope="col" className={head}>{copy.headers.company}</th>
            <th scope="col" className={`${head} hidden md:table-cell`}>{copy.headers.role}</th>
            <th scope="col" className={head}>{copy.headers.stage}</th>
            <th scope="col" className={head}>{copy.headers.next}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={`${row.company}-${row.role ?? ""}`} data-row="" className="border-b border-sr-soft align-top last:border-0">
              <th scope="row" className="px-3 py-3 text-left font-semibold">
                {row.company}
                <span className="mt-0.5 block text-xs font-normal text-sr-ink2 md:hidden">{row.role ?? copy.noRole}</span>
              </th>
              <td className="hidden px-3 py-3 text-sr-ink2 md:table-cell">{row.role ?? copy.noRole}</td>
              <td className="px-3 py-3">
                <span className={`${CHIP} ${row.exit === "open" ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink2"}`}>{stageLabel(row)}</span>
              </td>
              <td className="px-3 py-3 text-sr-ink2">{nextStep(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > DEFAULT_ROWS && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((now) => !now)}
          className="mt-3 rounded-full px-3 py-1.5 font-srcond text-xs uppercase tracking-wider text-sr-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple"
        >
          {showAll ? copy.showFewer : copy.showAll(total)}
        </button>
      )}
    </div>
  );
}
