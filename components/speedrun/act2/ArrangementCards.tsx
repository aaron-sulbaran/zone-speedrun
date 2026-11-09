import { speedrunCopy } from "@/lib/content";
import { ARRANGEMENTS, type Arrangement } from "@/lib/speedrun/onboarding";

const LETTERS = ["A", "B", "C", "D"];

// Lettered cards, A to D. The letter turns into a check once the card is picked.
export function ArrangementCards({ value, onToggle }: { value: Arrangement[]; onToggle: (item: Arrangement) => void }) {
  const copy = speedrunCopy.join.steps.arrangements;
  return (
    <div role="group" aria-label={copy.label} className="grid gap-2">
      {ARRANGEMENTS.map((item, index) => {
        const on = value.includes(item);
        return (
          <button
            key={item}
            type="button"
            data-chip=""
            data-phase-focus={index === 0 ? "" : undefined}
            aria-pressed={on}
            onClick={() => onToggle(item)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold shadow-[inset_0_0_0_1px_var(--sr-strong)] transition-[background-color,color] duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
              on ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink hover:bg-sr-strong"
            }`}
          >
            <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-srcond text-sm ${on ? "bg-sr-surface text-sr-ink" : "bg-sr-soft text-sr-ink2"}`}>
              {on ? "✓" : LETTERS[index]}
            </span>
            {copy.options[item]}
          </button>
        );
      })}
    </div>
  );
}
