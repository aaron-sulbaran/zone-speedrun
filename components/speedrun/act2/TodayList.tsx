"use client";

import { speedrunCopy } from "@/lib/content";
import type { Action, TodayItem } from "@/lib/speedrun/actions";
import { deadlineText } from "@/lib/speedrun/boardLabels";
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

/** What to know before the call: the points and the links, in a drop-down that needs no motion. */
function Prep({ action }: { action: Action }) {
  const points = action.sheet.prep ?? speedrunCopy.actions.defaultPrep;
  const links = action.sheet.links ?? [];
  return (
    <details data-today-prep="" className="mt-1">
      <summary aria-label={copy.today.prepLabel(action.company)} className={SUMMARY}>{copy.today.prep}</summary>
      <ul className="list-disc py-2 pl-5 text-sm">
        {points.map((point) => (
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

function Buttons({ item, shared }: { item: TodayItem; shared: Shared }) {
  const { action, join } = item;
  const settled = shared.isDone(action) ? action : join && shared.isDone(join) ? join : null;
  if (settled) return <ActionSlot action={settled} slot="today" label="" done picked={shared.pickedFor(settled)} className="" onOpen={shared.onOpen} />;
  if (join) {
    return (
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <ActionSlot action={join} slot="today" label={copy.today.join} done={false} className={SECONDARY} onOpen={shared.onOpen} />
        <button type="button" data-today-calendar="" onClick={(event) => shared.onOpen(join, event.currentTarget)} className={SECONDARY}>
          {copy.today.calendar}
        </button>
      </div>
    );
  }
  // An application to finish goes to the role's real page when the posting is known; otherwise it opens the sheet.
  const posting = action.kind === "finishApplication" || action.kind === "apply" ? action.sheet.links?.find((link) => link.label === speedrunCopy.actions.postingLink) : undefined;
  if (posting) {
    return (
      <a href={posting.href} data-today-action={action.kind} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
        {copy.nextStep[action.kind]}
      </a>
    );
  }
  return <ActionSlot action={action} slot="today" label={copy.nextStep[action.kind]} done={false} className={SECONDARY} onOpen={shared.onOpen} />;
}

function Row({ item, shared }: { item: TodayItem; shared: Shared }) {
  const { action, join } = item;
  const done = shared.isDone(action) || (!!join && shared.isDone(join));
  const when = join?.sheet.meeting?.when;
  return (
    <li data-today-item={action.kind} data-done={done} data-done-scope="" className={`py-3 transition-opacity duration-200 motion-reduce:transition-none ${done ? "opacity-70" : ""}`}>
      <div className={`flex flex-col gap-1 ${LIST_GRID}`}>
        <div className="min-w-0">
          <p data-today-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{action.company}</p>
          {action.role && <p className="text-sm text-sr-ink2">{action.role}</p>}
        </div>
        <p data-today-who="" className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">
          {when && action.who ? copy.today.interviewer(action.who.name, action.who.title, when) : action.who ? copy.needs.who(action.who.name, action.who.title) : copy.needs.team(action.company)}
        </p>
        <p className="text-sm font-semibold text-sr-ink">{deadlineText(action)}</p>
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
