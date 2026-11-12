import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import { shortDay } from "@/lib/speedrun/when";
import type { AppRow } from "@/lib/speedrun/types";
import { ActionSlot } from "./ActionSlot";
import { deadlineText, plainNextStep, stageLabel } from "./boardLabels";

const copy = speedrunCopy.board.table;
const CHIP = "inline-block whitespace-nowrap rounded-full px-2.5 py-1 font-srcond text-[11px] uppercase tracking-wider";
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
  if (!iso) {
    return (
      <>
        <span aria-hidden="true">-</span>
        <span className="sr-only">{copy.noApplied}</span>
      </>
    );
  }
  return <>{shortDay(iso)}</>;
}

export function BoardTableRow({ row, action, done, picked, onOpen }: Props) {
  return (
    <tr data-row="" className="border-b border-sr-soft last:border-0">
      <th scope="row" data-cell="company" className={`${CELL} min-w-[9rem] break-words text-left font-semibold [overflow-wrap:anywhere]`}>{row.company}</th>
      <td data-cell="role" className={`${CELL} min-w-[10rem] text-sr-ink2`}>{row.role ?? copy.noRole}</td>
      <td data-cell="stage" className={CELL}>
        <span className={`${CHIP} ${row.exit === "open" ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink2"}`}>{stageLabel(row)}</span>
      </td>
      <td data-cell="applied" className={`${CELL} whitespace-nowrap text-sr-ink2`}><DayCell iso={row.appliedAt} /></td>
      <td data-cell="lastUpdate" className={`${CELL} whitespace-nowrap text-sr-ink2`}><DayCell iso={row.lastEventAt} /></td>
      <td data-cell="next" data-done-scope="" className={`${CELL} min-w-[13rem]`}>
        {action ? (
          <div className="flex flex-wrap items-center gap-x-2">
            <ActionSlot action={action} slot="next" label={speedrunCopy.board.nextStep[action.kind]} done={done} picked={picked} className={LINK} onOpen={onOpen} />
            <span className="text-xs text-sr-ink2">{action.due ? deadlineText(action) : copy.quietFor(action.quietDays ?? 0)}</span>
          </div>
        ) : (
          <span className="text-sr-ink2">{plainNextStep(row)}</span>
        )}
      </td>
    </tr>
  );
}
