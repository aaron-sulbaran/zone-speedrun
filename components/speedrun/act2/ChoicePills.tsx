import { speedrunCopy } from "@/lib/content";

const PILL =
  "rounded-full px-7 py-[13px] font-srcond text-sm uppercase tracking-wider shadow-[inset_0_0_0_1px_var(--sr-ink)] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple focus-visible:ring-offset-2 motion-reduce:transition-none";

// Yes or No as two radio pills. Choosing calls `onChoose` at once; the card
// advances a beat later (useChoiceAdvance).
export function ChoicePills({ value, onChoose, label }: { value: boolean | null; onChoose: (value: boolean) => void; label: string }) {
  const copy = speedrunCopy.join;
  const options = [
    { value: true, text: copy.yes },
    { value: false, text: copy.no },
  ];
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex gap-3">
        {options.map((option, index) => {
          const on = value === option.value;
          return (
            <button
              key={option.text}
              type="button"
              role="radio"
              aria-checked={on}
              data-phase-focus={index === 0 ? "" : undefined}
              onClick={() => onChoose(option.value)}
              className={`${PILL} ${on ? "bg-sr-ink text-sr-surface" : "text-sr-ink hover:bg-sr-ink hover:text-sr-surface"}`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-sr-ink2">{copy.tapAdvances}</p>
    </div>
  );
}
