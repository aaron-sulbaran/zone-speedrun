import { speedrunCopy } from "@/lib/content";
import type { DeskCard as Card } from "@/lib/speedrun/desk";
import type { DeskStage } from "@/lib/speedrun/deskSamples";
import { FILLED, SECONDARY } from "../act2/IntroControls";

const copy = speedrunCopy.team;

type Props = { card: Card; stage: DeskStage; introSent: boolean; onReview: () => void; onOpenFounder: () => void; onOpenIntro: () => void; onTwoWeeks: () => void };

// The visitor's card has the ink border and carries the one action its column allows; the samples carry none.
export function DeskCard({ card, stage, introSent, onReview, onOpenFounder, onOpenIntro, onTwoWeeks }: Props) {
  return (
    <article data-desk-card="" data-mine={card.mine ? "true" : undefined} tabIndex={card.mine ? -1 : undefined} className={`min-w-0 rounded-xl focus:outline-none border bg-sr-surface p-3 ${card.mine ? "border-2 border-sr-ink" : "border-sr-soft"}`}>
      {card.mine && <p className="mb-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink">{copy.yours}</p>}
      <p className="break-words font-semibold text-sr-ink">{card.firstName}</p>
      <p className="break-words text-sm text-sr-ink2">
        <span data-card-company="">{card.company}</span>
        {card.role && <span>, {card.role}</span>}
      </p>
      {card.pill && <span className="mt-2 inline-block rounded-full bg-sr-hud px-2 py-0.5 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{card.pill}</span>}
      {card.mine && stage === "requested" && (
        <button type="button" onClick={onReview} className={`${FILLED} mt-3`}>
          {copy.review}
        </button>
      )}
      {card.mine && stage === "withFounder" && (
        <button type="button" onClick={onOpenFounder} className={`${SECONDARY} mt-3`}>
          {copy.openFounder}
        </button>
      )}
      {card.mine && stage === "connected" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onOpenIntro} className={SECONDARY}>
            {copy.openIntro}
          </button>
          {introSent && (
            <button type="button" onClick={onTwoWeeks} className={SECONDARY}>
              {copy.twoWeeks}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
