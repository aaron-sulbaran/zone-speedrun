import { Check } from "lucide-react";
import type { Action } from "@/lib/speedrun/actions";

type Slot = "needs" | "tile" | "next";

type Props = {
  action: Action;
  slot: Slot;
  label: string;
  done: boolean;
  picked?: string;
  className: string;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};

/**
 * One place an action can be started from: its button, or once it is done a quiet check that says what happened.
 * The same action shows up in the needs-you list, a tile's list and the table, and each keeps its own marker so focus has somewhere to land.
 */
export function ActionSlot({ action, slot, label, done, picked, className, onOpen }: Props) {
  if (done) {
    return (
      <span data-action-done={action.id} tabIndex={-1} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sr-ink2 focus:outline-none">
        <Check aria-hidden="true" size={16} />
        {picked ? `${action.sheet.done} ${picked}` : action.sheet.done}
      </span>
    );
  }
  const marker = { [`data-${slot}-action`]: action.kind };
  return (
    <button type="button" {...marker} onClick={(event) => onOpen(action, event.currentTarget)} className={className}>
      {label}
    </button>
  );
}
