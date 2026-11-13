import { speedrunCopy } from "@/lib/content";
import type { Action } from "./actions";
import { shortDay } from "./when";
import type { AppRow } from "./types";

const copy = speedrunCopy.board;

/** "Due Nov 9", or how long it has been quiet when nothing is due (a generic person has no dates). */
export function deadlineText(action: Action): string {
  if (action.due) return copy.needs.due(shortDay(action.due));
  return copy.needs.quiet(action.quietDays ?? 0);
}

/** Who an action is with: the named person, else the company's team, or a fund's team (a fund has no recruiting team). */
export function whoLine(action: Action): string {
  if (action.who) return copy.needs.who(action.who.name, action.who.title);
  return action.lane === "founder" ? copy.needs.fundTeam(action.company) : copy.needs.team(action.company);
}

/** A date for a table or list cell; the dash (with its plain words for a screen reader) stands in for one that does not exist. */
export function dayCell(iso: string | null): { text: string; hint: string | null } {
  return iso ? { text: shortDay(iso), hint: null } : { text: copy.table.noDate, hint: copy.table.noApplied };
}

export function stageLabel(row: AppRow): string {
  const { stages, exits } = speedrunCopy.flow;
  if (row.exit === "rejected") return exits.rejected;
  if (row.exit === "noreply") return exits.noreply;
  return stages[row.furthest];
}

/** The words for a row that has no action: closed, quiet or waiting. */
export function plainNextStep(row: AppRow): string {
  if (row.exit === "rejected") return copy.table.closed;
  if (row.exit === "noreply") return copy.table.quiet;
  return row.next ?? copy.table.closed;
}
