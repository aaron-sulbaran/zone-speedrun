"use client";

import { siteContent, speedrunCopy } from "@/lib/content";
import type { Action, IntroCard } from "@/lib/speedrun/actions";
import { ActionSlot } from "./ActionSlot";
import { SECONDARY } from "./IntroControls";

const copy = speedrunCopy.board;
const SOCIALS = siteContent.menu.socials;
// X shows only when the site's socials have an entry for it.
const LINKEDIN = SOCIALS.find((social) => social.key === "linkedin");
const X = SOCIALS.find((social) => (social.key as string) === "x");
const LINK = "inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-sr-ink underline underline-offset-4 hover:text-sr-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";
const CHIP = "inline-block whitespace-nowrap rounded-md border border-sr-soft bg-sr-surface px-2 py-0.5 font-srcond text-[11px] uppercase tracking-wider text-sr-ink";
const EMPTY_LINK = "inline-flex min-h-11 items-center rounded-full px-1 font-semibold text-sr-ink underline underline-offset-4 hover:text-sr-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

type Props = {
  cards: IntroCard[];
  isDone: (action: Action) => boolean;
  pickedFor: (action: Action) => string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
  onMatches: () => void;
};

const monogram = (name: string) => name.split(/\s+/).map((word) => word.charAt(0)).join("").slice(0, 2).toUpperCase();

function Card({ card, ...shared }: { card: IntroCard } & Omit<Props, "cards" | "onMatches">) {
  const { action } = card;
  const done = !!action && shared.isDone(action);
  const meeting = action?.sheet.meeting;
  return (
    <li data-intro-card={card.company} data-done={done} data-done-scope="" className={`flex flex-col gap-2 py-3 transition-opacity duration-200 motion-reduce:transition-none lg:flex-row lg:items-center lg:gap-4 ${done ? "opacity-70" : ""}`}>
      <span data-intro-monogram="" aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sr-ink font-srcond text-sm uppercase text-sr-surface">
        {monogram(card.who.name)}
      </span>
      <div className="min-w-0 lg:flex-1">
        <p data-intro-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{card.company}</p>
        <p data-intro-who="" className="break-words text-sm text-sr-ink2 [overflow-wrap:anywhere]">{copy.needs.who(card.who.name, card.who.title)}</p>
        <div className="-ml-2 flex flex-wrap items-center">
          {LINKEDIN && (
            <a href={LINKEDIN.href} target="_blank" rel="noopener noreferrer" className={LINK}>{copy.intros.linkedin(card.who.name)}</a>
          )}
          {X && (
            <a href={X.href} target="_blank" rel="noopener noreferrer" className={LINK}>{copy.intros.x(card.who.name)}</a>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 lg:w-56">
        <span data-intro-status="" className={CHIP}>{copy.introStatus[card.status]}</span>
        {card.status === "requested" && <p className="text-sm text-sr-ink2">{copy.intros.requestNote}</p>}
        {meeting && <p data-intro-when="" className="text-sm text-sr-ink2">{meeting.when}</p>}
      </div>
      {action && (
        <div className="flex flex-wrap gap-2 lg:w-60 lg:justify-end">
          <ActionSlot action={action} slot="intro" label={copy.nextStep[action.kind]} done={done} picked={shared.pickedFor(action)} className={SECONDARY} onOpen={shared.onOpen} />
          {meeting && !done && (
            <button type="button" data-intro-calendar="" onClick={(event) => shared.onOpen(action, event.currentTarget)} className={SECONDARY}>
              {copy.today.calendar}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** One card per company with an intro, and the visitor's own request first. The same list the Intros tile counts. */
export function WarmIntros({ cards, onMatches, ...shared }: Props) {
  if (cards.length === 0) {
    const empty = copy.intros.empty;
    return (
      <p data-intros-list="" className="text-base text-sr-ink">
        {empty.before}
        <button type="button" onClick={onMatches} className={EMPTY_LINK}>{empty.link}</button>
        {empty.after}
      </p>
    );
  }
  return (
    <ul data-intros-list="" className="divide-y divide-sr-soft">
      {cards.map((card) => (
        <Card key={card.company} card={card} {...shared} />
      ))}
    </ul>
  );
}
