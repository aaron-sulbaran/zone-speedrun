import { useRef, type KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";

const PILL =
  "rounded-full px-7 py-[13px] font-srcond text-sm uppercase tracking-wider shadow-[inset_0_0_0_1px_var(--sr-ink)] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple focus-visible:ring-offset-2 motion-reduce:transition-none";

// Yes or No as two radio pills. Choosing calls `onChoose` at once; the card
// advances a beat later (useChoiceAdvance), and arrowing between the pills
// reschedules that, so it fires once, on the final choice. Roving tabindex: the
// checked pill is the one tab stop (the first when none is), and the arrows move and select.
export function ChoicePills({ value, onChoose, label }: { value: boolean | null; onChoose: (value: boolean) => void; label: string }) {
  const copy = speedrunCopy.join;
  const groupRef = useRef<HTMLDivElement>(null);
  const options = [
    { value: true, text: copy.yes },
    { value: false, text: copy.no },
  ];
  const stopIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const radios = [...(groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
    // Move from the focused pill, which is the checked one once an answer exists.
    const current = radios.indexOf(document.activeElement as HTMLElement);
    const next = (Math.max(current, 0) + step + options.length) % options.length;
    onChoose(options[next].value);
    radios[next]?.focus();
  };

  return (
    <div>
      <div ref={groupRef} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex gap-3">
        {options.map((option, index) => {
          const on = value === option.value;
          return (
            <button
              key={option.text}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={index === stopIndex ? 0 : -1}
              data-phase-focus={index === stopIndex ? "" : undefined}
              onClick={() => onChoose(option.value)}
              className={`${PILL} ${on ? "bg-sr-ink text-sr-surface" : "text-sr-ink hover:bg-sr-ink hover:text-sr-surface"}`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
