import type { ReactNode } from "react";
import { speedrunCopy } from "@/lib/content";
import type { BoardCard } from "@/lib/speedrun/types";

const copy = speedrunCopy.board;
const SMALL =
  "rounded-full border border-sr-soft px-3 py-1.5 font-srcond text-[11px] uppercase tracking-wider text-sr-ink transition-colors duration-200 ease-sr hover:bg-sr-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none";

export function ArrangeToggle({ arranging, onToggle }: { arranging: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={arranging} onClick={onToggle} className={`${SMALL} ${arranging ? "bg-sr-ink text-sr-surface hover:bg-sr-ink" : ""}`}>
      {arranging ? copy.arrange.done : copy.arrange.button}
    </button>
  );
}

type FrameProps = {
  card: BoardCard;
  arranging: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onHide: () => void;
  children: ReactNode;
};

/** A board card with its heading, plus inline move and hide buttons while arranging. */
export function CardFrame({ card, arranging, canUp, canDown, onMove, onHide, children }: FrameProps) {
  const name = copy.cardNames[card];
  const heading = card === "tools" ? copy.tools.heading : card === "today" ? copy.today.heading : card === "intros" ? copy.intros.heading : name;
  return (
    <section data-board-card={card} aria-label={name} className="rounded-2xl border border-sr-soft bg-sr-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-srcond text-sm uppercase tracking-widest text-sr-purple">{heading}</h4>
        {arranging && (
          <div role="group" aria-label={name} className="flex gap-1.5">
            <button type="button" disabled={!canUp} aria-label={`${copy.arrange.up}: ${name}`} onClick={() => onMove(-1)} className={SMALL}>
              {copy.arrange.up}
            </button>
            <button type="button" disabled={!canDown} aria-label={`${copy.arrange.down}: ${name}`} onClick={() => onMove(1)} className={SMALL}>
              {copy.arrange.down}
            </button>
            <button type="button" aria-label={`${copy.arrange.hide}: ${name}`} onClick={onHide} className={SMALL}>
              {copy.arrange.hide}
            </button>
          </div>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HiddenCard({ card, onShow }: { card: BoardCard; onShow: () => void }) {
  const name = copy.cardNames[card];
  return (
    <div data-board-hidden={card} className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-sr-strong px-5 py-3">
      <span className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">{name}</span>
      <button type="button" aria-label={`${copy.arrange.show}: ${name}`} onClick={onShow} className={SMALL}>
        {copy.arrange.show}
      </button>
    </div>
  );
}
