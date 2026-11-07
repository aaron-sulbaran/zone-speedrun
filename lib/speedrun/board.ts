import { INBOX_TODAY } from "./inbox";
import type { AppRow, BoardCard, InboxEmail, InboxEvent } from "./types";

// The board's pure helpers: card movement, which rows to show, which events
// belong on the Today and Intros cards, and turning pasted text into an email.

const MAX_PASTE_CHARS = 20_000;
const MOVABLE = (card: BoardCard): boolean => card !== "matches";

/** The index `moveCard` takes to shift `card` one visible step, or null at an end. The matches section sits above the board and is skipped. */
export function moveTarget(order: BoardCard[], card: BoardCard, direction: -1 | 1): number | null {
  const visible = order.filter(MOVABLE);
  const at = visible.indexOf(card);
  const neighbor = visible[at + direction];
  if (at < 0 || neighbor === undefined) return null;
  const rest = order.filter((other) => other !== card);
  return rest.indexOf(neighbor) + (direction === 1 ? 1 : 0);
}

/** Live rows first, then the most recent; capped unless `showAll`. */
export function tableRows(rows: AppRow[], showAll: boolean, limit: number): { shown: AppRow[]; total: number } {
  const ordered = [...rows].sort(
    (a, b) => Number(b.exit === "open") - Number(a.exit === "open") || b.lastEventAt.localeCompare(a.lastEventAt) || a.company.localeCompare(b.company),
  );
  return { shown: showAll ? ordered : ordered.slice(0, limit), total: ordered.length };
}

export function todayEvents(events: InboxEvent[], today: string): InboxEvent[] {
  return events.filter((event) => event.kind !== "other" && event.date.startsWith(today)).sort((a, b) => b.date.localeCompare(a.date));
}

export function introEvents(events: InboxEvent[]): InboxEvent[] {
  return events.filter((event) => event.kind === "intro").sort((a, b) => b.date.localeCompare(a.date));
}

const HEADER = /^(from|subject|date|to|cc)\s*:\s*(.*)$/i;

/** One pasted email. "From:" and "Subject:" lines are read when present; otherwise the first line is the subject. Dated to the demo's today. */
export function parsePasted(text: string, serial: number): InboxEmail | null {
  const clipped = text.slice(0, MAX_PASTE_CHARS);
  if (clipped.trim() === "") return null;
  const lines = clipped.replace(/\r\n?/g, "\n").split("\n");
  let from = "";
  let subject = "";
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    const header = HEADER.exec(line);
    if (line === "" && index === 0) {
      index += 1;
      continue;
    }
    if (!header) break;
    const name = header[1].toLowerCase();
    if (name === "from") from = header[2].trim();
    if (name === "subject") subject = header[2].trim();
    index += 1;
  }
  let body = lines.slice(index).join("\n").trim();
  if (subject === "") {
    const rest = body.split("\n");
    subject = (rest.shift() ?? "").trim();
    body = rest.join("\n").trim();
  }
  if (subject === "" && body === "") return null;
  return { id: `pasted-${serial}`, from, subject, body, date: `${INBOX_TODAY}T12:00:00.000Z` };
}
