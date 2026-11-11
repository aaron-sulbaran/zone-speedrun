import type { ReactNode } from "react";
import { speedrunCopy } from "@/lib/content";
import type { BoardCard } from "@/lib/speedrun/types";

const copy = speedrunCopy.board;

/** A board card with its heading. */
export function CardFrame({ card, children }: { card: BoardCard; children: ReactNode }) {
  const name = copy.cardNames[card];
  const heading = card === "tools" ? copy.tools.heading : card === "today" ? copy.today.heading : card === "intros" ? copy.intros.heading : name;
  return (
    <section data-board-card={card} aria-label={name} className="rounded-2xl border border-sr-soft bg-sr-surface p-5 md:p-6">
      <h4 className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">{heading}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}
