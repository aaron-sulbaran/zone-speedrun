import type { Action } from "./actions";
import { classifyEmail } from "./classify";
import { INBOX_TODAY } from "./inbox";
import { rowKey } from "./keys";
import { STAGES } from "./pipeline";
import type { AppRow, InboxEmail, InboxEvent, Stage } from "./types";

// The board's pure helpers: which rows to show and in what order, which events
// belong on the Today and Intros cards, and turning pasted text into an email.

const MAX_PASTE_CHARS = 20_000;
const MAX_HEADER_CHARS = 200;
const SENDER_SEARCH_LINES = 6;

export type BoardFilter = "all" | "inProcess" | "offers" | "intros" | "closed";
export type SortKey = "company" | "role" | "stage" | "applied" | "lastUpdate" | "next";

export const BOARD_FILTERS: BoardFilter[] = ["all", "inProcess", "offers", "intros", "closed"];

export type TileKey = "applied" | "inProcess" | "intros" | "offers";
/** Applied is every row, so its tile sets the filter to All. */
export const TILE_FILTER: Record<TileKey, BoardFilter> = { applied: "all", inProcess: "inProcess", intros: "intros", offers: "offers" };
/** The tile a chip belongs to; All and Closed have none. */
export const tileOfFilter = (filter: BoardFilter): TileKey | null => (filter === "all" || filter === "closed" ? null : filter);

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
    case "intros":
      return rows.filter((row) => row.lane === "founder");
    case "closed":
      return rows.filter((row) => row.exit !== "open");
  }
}

/** Open rows by how far they got, then rejected, then no reply. */
const stageRank = (row: AppRow) => (row.exit === "open" ? STAGES.indexOf(row.furthest) : STAGES.length + (row.exit === "rejected" ? 0 : 1));

/** The row's next due date, from its action; null when nothing is due. */
export const dueOf = (row: AppRow, actions: Map<string, Action>) => actions.get(rowKey(row))?.due ?? null;

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

const HEADER = /^(from|subject|date|sent|to|cc|bcc|reply-to)\s*:\s*(.*)$/i;
// "---------- Forwarded message ---------" and "Begin forwarded message:" sit above the real headers.
const FORWARD_RULE = /^(-{2,}\s*(forwarded|original) message\s*-{2,}|begin forwarded message:?)$/i;
// A copied Gmail sender line: a name and an address in angle brackets, nothing else.
// The name is a few words (no commas or colons), so a sentence that happens to hold an address is not a sender.
const BARE_SENDER = /^(?:(?:from|sender)\s*:\s*)?("?[\p{L}][\p{L}.'&-]*(?:\s+[\p{L}][\p{L}.'&-]*){0,4}"?\s*<[^\s<>@]+@[^\s<>@]+>)$/iu;

/** Same sender, subject, day and text give the same id, so pasting an email twice is caught while a later reply with the same subject is not. */
function stableId(...parts: string[]): string {
  let hash = 5381;
  for (const char of parts.join("\u0001")) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0;
  return `pasted-${hash.toString(36)}`;
}

/** One pasted email. "From:" and "Subject:" lines are read when present, or a bare "Name <address>" line near the top; otherwise the first line is the subject. Dated to the demo's morning, before the 8:02 brief, so this morning's brief hears it. */
export function parsePasted(text: string): InboxEmail | null {
  const lines = text.slice(0, MAX_PASTE_CHARS).replace(/\r\n?/g, "\n").split("\n");
  let from = "";
  let subject = "";
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    const header = HEADER.exec(line);
    if ((line === "" || FORWARD_RULE.test(line)) && from === "" && subject === "") {
      index += 1;
      continue;
    }
    if (!header) break;
    const name = header[1].toLowerCase();
    if (name === "from") from = header[2].trim();
    if (name === "subject") subject = header[2].trim();
    index += 1;
  }
  const rest = lines.slice(index);
  if (from === "") {
    const at = rest.slice(0, SENDER_SEARCH_LINES).findIndex((line) => BARE_SENDER.test(line.trim()));
    if (at >= 0) from = (BARE_SENDER.exec(rest.splice(at, 1)[0].trim()) as RegExpExecArray)[1];
  }
  if (subject === "") {
    const first = rest.findIndex((line) => line.trim() !== "");
    if (first >= 0) subject = rest.splice(first, 1)[0].trim();
  }
  const body = rest.join("\n").trim();
  if (subject === "" && body === "") return null;
  from = from.slice(0, MAX_HEADER_CHARS);
  subject = subject.slice(0, MAX_HEADER_CHARS);
  const date = `${INBOX_TODAY}T08:00:00.000Z`;
  return { id: stableId(from, subject, date, body), from, subject, body, date };
}

export type PasteOutcome =
  | { kind: "added"; event: InboxEvent }
  | { kind: "unknown" }
  | { kind: "unknownSender" }
  | { kind: "duplicate" };

/** Parses and classifies one pasted email against what the board already holds. */
export function readPaste(text: string, existing: InboxEvent[]): PasteOutcome {
  const email = parsePasted(text);
  if (!email) return { kind: "unknown" };
  const event = classifyEmail(email);
  if (event.kind === "other") return { kind: "unknown" };
  if (event.company === "Unknown") return { kind: "unknownSender" };
  if (existing.some((known) => known.emailId === event.emailId)) return { kind: "duplicate" };
  return { kind: "added", event };
}
