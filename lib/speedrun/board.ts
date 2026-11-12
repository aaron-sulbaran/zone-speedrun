import type { Action } from "./actions";
import { rowKey } from "./keys";
import { STAGES } from "./pipeline";
import type { AppRow, InboxEvent, Stage } from "./types";

// The board's pure helpers: which rows to show and in what order, and which events
// belong to the day and to the intros.

export type BoardFilter = "all" | "inProcess" | "offers" | "closed";
export type SortKey = "company" | "role" | "stage" | "applied" | "lastUpdate" | "next";

export const BOARD_FILTERS: BoardFilter[] = ["all", "inProcess", "offers", "closed"];

export type TileKey = "applied" | "inProcess" | "intros" | "offers";
/** The tiles that filter the table. Applied is every row, so it sets the filter to All; Intros lists warm intros and leaves the table alone. */
export const TILE_FILTER: Partial<Record<TileKey, BoardFilter>> = { applied: "all", inProcess: "inProcess", offers: "offers" };
/** The tile a chip belongs to; All and Closed have none. */
export const tileOfFilter = (filter: BoardFilter): TileKey | null => (filter === "inProcess" || filter === "offers" ? filter : null);

// In process counts the same rows the tile counts: open and past the application, before an offer. Applied is every row.
const IN_PROCESS: Stage[] = ["assessment", "screen", "interview"];

/** The rows one tile or chip stands for. "all" is the Applied tile. */
export function filterRows(rows: AppRow[], filter: BoardFilter): AppRow[] {
  switch (filter) {
    case "all":
      return rows;
    case "inProcess":
      return rows.filter((row) => row.exit === "open" && IN_PROCESS.includes(row.furthest));
    case "offers":
      return rows.filter((row) => row.exit === "open" && row.furthest === "offer");
    case "closed":
      return rows.filter((row) => row.exit !== "open");
  }
}

/** Open rows by how far they got, then rejected, then no reply. */
const stageRank = (row: AppRow) => (row.exit === "open" ? STAGES.indexOf(row.furthest) : STAGES.length + (row.exit === "rejected" ? 0 : 1));

/** The row's next due date, from its action; null when nothing is due. */
const dueOf = (row: AppRow, actions: Map<string, Action>) => actions.get(rowKey(row))?.due ?? null;

type Cell = string | number | null;

function cellOf(row: AppRow, key: SortKey, actions: Map<string, Action>): Cell {
  switch (key) {
    case "company":
      return row.company.toLowerCase();
    case "role":
      return row.role?.toLowerCase() ?? null;
    case "stage":
      return stageRank(row);
    case "applied":
      return row.appliedAt;
    case "lastUpdate":
      return row.lastEventAt;
    case "next":
      return dueOf(row, actions);
  }
}

const compareCells = (a: Cell, b: Cell) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));

/**
 * Sorts by one column. A row with nothing in that column goes last in either direction.
 * Ties fall back to the newest update, then the company and role, so the order is the same on every render.
 * Next step sorts by due date, so the default (ascending) puts the soonest deadline first.
 */
export function sortRows(rows: AppRow[], key: SortKey, dir: "asc" | "desc", actions: Map<string, Action>): AppRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = cellOf(a, key, actions);
    const right = cellOf(b, key, actions);
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      const order = compareCells(left, right);
      if (order !== 0) return sign * order;
    }
    return b.lastEventAt.localeCompare(a.lastEventAt) || a.company.localeCompare(b.company) || (a.role ?? "").localeCompare(b.role ?? "");
  });
}

/** What the Board's top shows: the whole board, a prompt to connect the sample person's inbox, or the one-line pointer. */
export function boardMode(personKey: string | null, connected: boolean, rowCount: number): "full" | "connect" | "empty" {
  if (connected && rowCount > 0) return "full";
  return !connected && personKey ? "connect" : "empty";
}

export function todayEvents(events: InboxEvent[], today: string): InboxEvent[] {
  return events.filter((event) => event.kind !== "other" && event.date.startsWith(today)).sort((a, b) => b.date.localeCompare(a.date));
}

export function introEvents(events: InboxEvent[]): InboxEvent[] {
  return events.filter((event) => event.kind === "intro").sort((a, b) => b.date.localeCompare(a.date));
}
