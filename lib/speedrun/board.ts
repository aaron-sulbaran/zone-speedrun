import { classifyEmail } from "./classify";
import { INBOX_TODAY } from "./inbox";
import { STAGES } from "./pipeline";
import type { AppRow, InboxEmail, InboxEvent } from "./types";

// The board's pure helpers: which rows to show, which events
// belong on the Today and Intros cards, and turning pasted text into an email.

const MAX_PASTE_CHARS = 20_000;
const MAX_HEADER_CHARS = 200;
const SENDER_SEARCH_LINES = 6;

/** Live rows first, then the furthest stage, then the most recent; capped unless `showAll`. */
export function tableRows(rows: AppRow[], showAll: boolean, limit: number): { shown: AppRow[]; total: number } {
  const ordered = [...rows].sort(
    (a, b) =>
      Number(b.exit === "open") - Number(a.exit === "open") ||
      STAGES.indexOf(b.furthest) - STAGES.indexOf(a.furthest) ||
      b.lastEventAt.localeCompare(a.lastEventAt) ||
      a.company.localeCompare(b.company),
  );
  return { shown: showAll ? ordered : ordered.slice(0, limit), total: ordered.length };
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
