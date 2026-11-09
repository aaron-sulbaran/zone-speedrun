import type { CSSProperties, ReactNode } from "react";
import { motion } from "@/lib/speedrun/motion";

// A frosted pill that toggles. Picking it sweeps the black fill in (`.sr-chip`
// in globals.css). Enter on a chip moves the join card forward (handled on the
// card), Space toggles it.
export function Chip({ pressed, onToggle, disabled = false, focusFirst = false, children }: { pressed: boolean; onToggle: () => void; disabled?: boolean; focusFirst?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      data-chip=""
      data-phase-focus={focusFirst ? "" : undefined}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      style={{ "--sr-chip-ms": `${motion().chipSweepMs}ms` } as CSSProperties}
      className="sr-chip rounded-full px-4 py-2 text-sm font-semibold backdrop-blur disabled:opacity-40"
    >
      {children}
    </button>
  );
}
