import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import { shortDay } from "@/lib/speedrun/when";
import type { AppRow } from "@/lib/speedrun/types";

const copy = speedrunCopy.board;

/** "Due Nov 9", or how long it has been quiet when nothing is due (a generic person has no dates). */
export function deadlineText(action: Action): string {
  if (action.due) return copy.needs.due(shortDay(action.due));
  return copy.needs.quiet(action.quietDays ?? 0);
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
