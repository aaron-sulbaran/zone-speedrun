import type { ReactNode, Ref } from "react";
import { speedrunCopy } from "@/lib/content";
import type { BoardCard } from "@/lib/speedrun/types";

const copy = speedrunCopy.board;
const SMALL =
  "rounded-full border border-sr-soft px-3 py-1.5 font-srcond text-[11px] uppercase tracking-wider text-sr-ink transition-colors duration-200 ease-sr hover:bg-sr-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple aria-disabled:opacity-40 aria-disabled:hover:bg-transparent motion-reduce:transition-none";

export type ControlKind = "up" | "down" | "hide" | "show";
/** Gives Board a handle on each control, so it can put focus back after a card moves or its button swaps. */
export type ControlRef = (card: BoardCard, kind: ControlKind) => Ref<HTMLButtonElement>;

// The label changes between Arrange and Done, so it is not also a pressed toggle.
export function ArrangeToggle({ arranging, onToggle }: { arranging: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`${SMALL} ${arranging ? "bg-sr-ink text-sr-surface hover:bg-sr-ink" : ""}`}>
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
  controlRef: ControlRef;
  children: ReactNode;
};

/** A board card with its heading, plus inline move and hide buttons while arranging. The end-of-list buttons stay focusable (aria-disabled) so focus never falls out of the list. */
export function CardFrame({ card, arranging, canUp, canDown, onMove, onHide, controlRef, children }: FrameProps) {
  const name = copy.cardNames[card];
  const heading = card === "tools" ? copy.tools.heading : card === "today" ? copy.today.heading : card === "intros" ? copy.intros.heading : name;
  return (
    <section data-board-card={card} aria-label={name} className="rounded-2xl border border-sr-soft bg-sr-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">{heading}</h4>
        {arranging && (
          <div role="group" aria-label={name} className="flex gap-1.5">
            <button ref={controlRef(card, "up")} type="button" aria-disabled={!canUp} aria-label={`${copy.arrange.up}: ${name}`} onClick={() => canUp && onMove(-1)} className={SMALL}>
              {copy.arrange.up}
            </button>
            <button ref={controlRef(card, "down")} type="button" aria-disabled={!canDown} aria-label={`${copy.arrange.down}: ${name}`} onClick={() => canDown && onMove(1)} className={SMALL}>
              {copy.arrange.down}
            </button>
            <button ref={controlRef(card, "hide")} type="button" aria-label={`${copy.arrange.hide}: ${name}`} onClick={onHide} className={SMALL}>
              {copy.arrange.hide}
            </button>
          </div>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HiddenCard({ card, onShow, controlRef }: { card: BoardCard; onShow: () => void; controlRef: ControlRef }) {
  const name = copy.cardNames[card];
  return (
    <div data-board-hidden={card} className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-sr-strong px-5 py-3">
      <span className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">{name}</span>
      <button ref={controlRef(card, "show")} type="button" aria-label={`${copy.arrange.show}: ${name}`} onClick={onShow} className={SMALL}>
        {copy.arrange.show}
      </button>
    </div>
  );
}
