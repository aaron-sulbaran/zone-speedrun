"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import type { AppRow } from "@/lib/speedrun/types";
import { ActionSlot } from "./ActionSlot";
import { deadlineText, stageLabel } from "./boardLabels";
import { FILLED } from "./IntroControls";

const copy = speedrunCopy.board;
const TOGGLE = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 font-srcond text-xs uppercase tracking-wider text-sr-ink2 hover:text-sr-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";
const LINK = "inline-flex min-h-11 items-center rounded-full bg-sr-hud px-4 text-sm font-semibold text-sr-ink hover:bg-sr-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

type Props = {
  actions: Action[];
  rows: AppRow[];
  isDone: (action: Action) => boolean;
  pickedFor: (action: Action) => string | undefined;
  onOpen: (action: Action, opener: HTMLButtonElement) => void;
};

/** What needs the visitor today, in the order the data ranks it. A done item stays where it is, dimmed with a quiet check. */
export function NeedsYou({ actions, rows, isDone, pickedFor, onOpen }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (actions.length === 0) return null;
  return (
    <section data-needs-you="" aria-label={copy.needs.label}>
      <ul className="divide-y divide-sr-soft rounded-2xl border border-sr-soft bg-sr-surface">
        {actions.map((action) => {
          const done = isDone(action);
          const row = rows.find((entry) => entry.company === action.company && entry.role === action.role);
          const detailsId = `sr-needs-${actions.indexOf(action)}`;
          return (
            <li key={action.id} data-needs-item={action.kind} data-done={done} data-done-scope="" className={`px-4 py-3 transition-opacity duration-200 motion-reduce:transition-none md:px-5 ${done ? "opacity-70" : ""}`}>
              <div className="flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_9rem_auto] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p data-needs-company="" className="break-words font-semibold [overflow-wrap:anywhere]">{action.company}</p>
                  <p data-needs-what="" className="text-sm text-sr-ink2">{copy.nextStep[action.kind]}</p>
                </div>
                <p data-needs-who="" className="min-w-0 break-words text-sm text-sr-ink [overflow-wrap:anywhere]">
                  {action.who ? copy.needs.who(action.who.name, action.who.title) : copy.needs.team(action.company)}
                </p>
                <p data-needs-due="" className="text-sm font-semibold text-sr-ink">{deadlineText(action)}</p>
                <div className="flex items-center gap-1">
                  <ActionSlot action={action} slot="needs" label={speedrunCopy.actions.briefButtons[action.kind]} done={done} picked={pickedFor(action)} className={FILLED} onOpen={onOpen} />
                  <button type="button" data-needs-toggle="" aria-expanded={expanded === action.id} aria-controls={expanded === action.id ? detailsId : undefined} aria-label={copy.needs.detailsLabel(action.company)} onClick={() => setExpanded(expanded === action.id ? null : action.id)} className={TOGGLE}>
                    {copy.needs.details}
                    <ChevronDown aria-hidden="true" size={14} className={expanded === action.id ? "rotate-180" : ""} />
                  </button>
                </div>
              </div>
              {expanded === action.id && (
                <div id={detailsId} data-needs-details="" className="mt-2 flex flex-col gap-2 text-sm text-sr-ink2">
                  <p>{action.sheet.title}</p>
                  {row && <p>{copy.needs.row(row.role, stageLabel(row))}</p>}
                  {action.sheet.links && (
                    <ul className="flex flex-wrap gap-2">
                      {action.sheet.links.map((link) => (
                        <li key={link.href}>
                          <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
