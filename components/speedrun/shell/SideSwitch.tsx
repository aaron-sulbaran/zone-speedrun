"use client";

import { speedrunCopy } from "@/lib/content";
import type { Side } from "@/lib/speedrun/phase";

const copy = speedrunCopy.team.switch;
const SIDES: readonly { side: Side; label: string }[] = [
  { side: "candidate", label: copy.candidate },
  { side: "team", label: copy.team },
];

type SideSwitchProps = { side: Side; onSide: (side: Side) => void };

// Candidate or Talent team: two toggle buttons in one pill. Both stay mounted across a flip, so focus stays
// on the pressed one. Below sm the pill spans its row in two equal halves; from sm it hugs its labels.
export function SideSwitch({ side, onSide }: SideSwitchProps) {
  return (
    <div data-side-switch="" role="group" aria-label={copy.label} className="flex w-full gap-1 rounded-full bg-sr-hud p-1 sm:inline-flex sm:w-auto">
      {SIDES.map((option) => {
        const pressed = option.side === side;
        return (
          <button
            key={option.side}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSide(option.side)}
            className={`min-h-[44px] min-w-[44px] flex-1 whitespace-nowrap rounded-full px-4 font-srcond text-xs uppercase tracking-wider transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none sm:flex-none ${
              pressed ? "bg-sr-ink text-sr-surface" : "text-sr-ink hover:bg-sr-strong"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
