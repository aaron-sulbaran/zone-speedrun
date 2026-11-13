"use client";

import { speedrunCopy } from "@/lib/content";
import type { Action, TodayItem } from "@/lib/speedrun/actions";
import { deadlineText, whoLine } from "@/lib/speedrun/boardLabels";
import { shortDay } from "@/lib/speedrun/when";
import { ActionSlot } from "./ActionSlot";
import { SECONDARY } from "./IntroControls";
import { LIST_GRID } from "./listGrid";

const copy = speedrunCopy.board;
const SUMMARY = "inline-flex min-h-11 cursor-pointer items-center rounded-full px-1 font-srcond text-xs uppercase tracking-wider text-sr-ink2 hover:text-sr-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";
const LINK = "inline-flex min-h-11 items-center rounded-full bg-sr-hud px-4 text-sm font-semibold text-sr-ink hover:bg-sr-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

type Shared = {
  isDone: (action: Action) => boolean;
  pickedFor: (action: Action) => string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};

/** What to know before the call: the sheet's own points and links, in a drop-down that needs no motion. */
function Prep({ action }: { action: Action }) {
  const links = action.sheet.links ?? [];
  return (
    <details data-today-prep="" className="mt-1">
      <summary aria-label={copy.today.prepLabel(action.company)} className={SUMMARY}>{copy.today.prep}</summary>
      <ul data-today-prep-points="" className="list-disc py-2 pl-5 text-sm">
        {(action.sheet.prep ?? []).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {links.length > 0 && (
        <ul className="flex flex-wrap gap-2 pb-2">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>{link.label}</a>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** An interview with a booked call: confirm it, then join it. Add to calendar is its own action and never settles the row. */
function Buttons({ item, shared }: { item: TodayItem; shared: Shared }) {
  const { action, join, calendar } = item;
  if (!join) return <ActionSlot action={action} slot="today" label={copy.nextStep[action.kind]} done={shared.isDone(action)} picked={shared.pickedFor(action)} className={SECONDARY} onOpen={shared.onOpen} />;
  if (shared.isDone(join)) return <ActionSlot action={join} slot="today" label="" done picked={shared.pickedFor(join)} className="" onOpen={shared.onOpen} />;
  // Joining is for after the confirmation; until then the row carries the very action Needs you carries.
  const first = action.kind === "confirmInterview" && !shared.isDone(action) ? action : join;
  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      <ActionSlot action={first} slot="today" label={first === join ? copy.today.join : speedrunCopy.actions.briefButtons.confirmInterview} done={false} className={SECONDARY} onOpen={shared.onOpen} />
      {calendar && shared.isDone(calendar) ? (
        <ActionSlot action={calendar} slot="today" label="" done className="" onOpen={shared.onOpen} />
      ) : (
        calendar && (
          <button type="button" data-today-calendar="" onClick={(event) => shared.onOpen(calendar, event.currentTarget)} className={SECONDARY}>
            {copy.today.calendar}
          </button>
        )
      )}
    </div>
  );
}

function Row({ item, shared }: { item: TodayItem; shared: Shared }) {
  const { action, join } = item;
  const done = shared.isDone(join ?? action);
  const when = join?.sheet.meeting?.when;
  // Confirm by only matters until the interview is confirmed; after that, and after the call is joined, the row shows the meeting time alone.
  const confirming = action.kind === "confirmInterview" && !!join && !shared.isDone(action);
  return (
    <li data-today-item={action.kind} data-done={done} data-done-scope="" className={`py-3 transition-opacity duration-200 motion-reduce:transition-none ${done ? "opacity-70" : ""}`}>
      <div className={`flex flex-col gap-1 ${LIST_GRID}`}>
        <div className="min-w-0">
          <p data-today-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{action.company}</p>
          {action.role && <p className="text-sm text-sr-ink2">{action.role}</p>}
        </div>
        <p data-today-who="" className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">
          {whoLine(action)}
        </p>
        <div className="text-sm font-semibold text-sr-ink">
          {when && <p data-today-when="">{when}</p>}
          {(!join || confirming) && <p data-today-due="">{confirming && action.due ? copy.today.confirmBy(shortDay(action.due)) : deadlineText(action)}</p>}
        </div>
        <div className="lg:justify-self-end">
          <Buttons item={item} shared={shared} />
        </div>
      </div>
      {action.kind === "prepare" && <Prep action={action} />}
    </li>
  );
}

/** What moved today, each as a to-do with the action that settles it. A done item stays where it is, dimmed. */
export function TodayList({ items, ...shared }: { items: TodayItem[] } & Shared) {
  if (items.length === 0) return <p data-today-list="" className="text-sm text-sr-ink2">{copy.today.empty}</p>;
  return (
    <ul data-today-list="" className="divide-y divide-sr-soft">
      {items.map((item) => (
        <Row key={item.action.id} item={item} shared={shared} />
      ))}
    </ul>
  );
}
