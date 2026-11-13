import { Check } from "lucide-react";
import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import type { BriefItem } from "@/lib/speedrun/brief";
import { cleanUrl } from "@/lib/speedrun/cleanUrl";

const copy = speedrunCopy.actions;
const BUTTON = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-sr-hud px-4 text-sm font-semibold text-sr-ink transition-colors duration-200 hover:bg-sr-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none";

type Props = { item: BriefItem; action: Action | null; done: boolean; picked?: string; onOpen: (action: Action, opener: HTMLButtonElement) => void };

// One brief line: its words, then its one-tap button. A confirmed line stays where it is, quiet, and says what happened.
export function BriefLine({ item, action, done, picked, onOpen }: Props) {
  return (
    <li data-brief-item={item.kind} data-done={done} data-done-scope="" className={`py-3 transition-opacity duration-200 motion-reduce:transition-none ${done ? "opacity-70" : ""}`}>
      <p data-brief-text="">{item.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {done && action ? (
          <span data-brief-done={action.id} data-action-done={action.id} tabIndex={-1} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sr-ink2 focus:outline-none">
            <Check aria-hidden="true" size={16} />
            {picked ? `${action.sheet.done} ${picked}` : action.sheet.done}
          </span>
        ) : (
          action && (
            <button type="button" data-brief-action={action.kind} onClick={(event) => onOpen(action, event.currentTarget)} className={BUTTON}>
              {copy.briefButtons[action.kind]}
            </button>
          )
        )}
        {item.kind === "new-role" && item.href && (
          <a href={cleanUrl(item.href)} data-brief-apply="" target="_blank" rel="noopener noreferrer" className={BUTTON}>
            {copy.briefButtons.apply}
          </a>
        )}
      </div>
    </li>
  );
}
