import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import type { AppRow } from "@/lib/speedrun/types";
import { ActionSlot } from "./ActionSlot";
import { dayCell, deadlineText, plainNextStep, stageLabel } from "@/lib/speedrun/boardLabels";

const copy = speedrunCopy.board.table;
// A label, not a button: square-ish corners, a line border and ink text, never the filled ink pill the actions use.
const CHIP = "inline-block whitespace-nowrap rounded-md border bg-sr-surface px-2 py-0.5 font-srcond text-[11px] uppercase tracking-wider";
const LINK = "inline-flex min-h-11 min-w-11 items-center rounded-full px-2 text-left text-sm font-semibold text-sr-ink underline underline-offset-4 hover:text-sr-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";
const CELL = "px-3 py-1 align-middle";

type Props = {
  row: AppRow;
  action: Action | undefined;
  done: boolean;
  picked: string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};

function DayCell({ iso }: { iso: string | null }) {
  const cell = dayCell(iso);
  if (!cell.hint) return <>{cell.text}</>;
  return (
    <>
      <span aria-hidden="true">{cell.text}</span>
      <span className="sr-only">{cell.hint}</span>
    </>
  );
}

function chipTone(row: AppRow): string {
  if (row.exit !== "open") return "border-sr-soft text-sr-ink2";
  return row.furthest === "offer" ? "border-sr-ink font-semibold text-sr-ink" : "border-sr-soft text-sr-ink";
}

export function BoardTableRow({ row, action, done, picked, onOpen }: Props) {
  return (
    <tr data-row="" className="h-14 border-b border-sr-soft last:border-0">
      <th scope="row" data-cell="company" className={`${CELL} min-w-[9rem] break-words lg:min-w-0 text-left font-semibold [overflow-wrap:anywhere]`}>{row.company}</th>
      <td data-cell="role" className={`${CELL} min-w-[10rem] text-sr-ink2 lg:min-w-0`}>{row.role ?? copy.noRole}</td>
      <td data-cell="stage" className={CELL}>
        <span className={`${CHIP} ${chipTone(row)}`}>{stageLabel(row)}</span>
      </td>
      <td data-cell="applied" className={`${CELL} whitespace-nowrap text-sr-ink2`}><DayCell iso={row.appliedAt} /></td>
      <td data-cell="lastUpdate" className={`${CELL} whitespace-nowrap text-sr-ink2`}><DayCell iso={row.lastEventAt} /></td>
      <td data-cell="next" data-done-scope="" className={`${CELL} min-w-[18rem] lg:min-w-0`}>
        {action ? (
          <div className="flex items-center gap-x-2 whitespace-nowrap">
            <ActionSlot action={action} slot="next" label={speedrunCopy.board.nextStep[action.kind]} done={done} picked={picked} className={LINK} onOpen={onOpen} />
            <span className="text-xs text-sr-ink2">{action.due ? deadlineText(action) : speedrunCopy.board.needs.quiet(action.quietDays ?? 0)}</span>
          </div>
        ) : (
          <span className="text-sr-ink2">{plainNextStep(row)}</span>
        )}
      </td>
    </tr>
  );
}
