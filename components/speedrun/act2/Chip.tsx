import type { ReactNode } from "react";

// A frosted pill that toggles. Enter on a chip moves the join card forward
// (handled on the card), Space toggles it.
export function Chip({ pressed, onToggle, disabled = false, children }: { pressed: boolean; onToggle: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      data-chip=""
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={`rounded-full px-4 py-2 text-sm font-semibold backdrop-blur transition-[background-color,color,transform] duration-200 ease-sr disabled:opacity-40 active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${
        pressed ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink hover:bg-sr-strong"
      }`}
    >
      {children}
    </button>
  );
}
