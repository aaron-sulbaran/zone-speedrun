import { speedrunCopy } from "@/lib/content";
import type { TileKey } from "@/lib/speedrun/board";
import type { Pipeline } from "@/lib/speedrun/types";
import { CountUp } from "./CountUp";

const TILE_KEYS: TileKey[] = ["applied", "inProcess", "intros", "offers"];

type Props = { stats: Pipeline["stats"]; open: TileKey | null; onToggle: (key: TileKey) => void };

/** The four big numbers, each a toggle: one press opens its list and filters the table, the next press puts both back. */
export function BoardStats({ stats, open, onToggle }: Props) {
  const labels = speedrunCopy.board.statLabels;
  return (
    <div data-board-stats="" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          data-stat={key}
          data-value={stats[key]}
          aria-pressed={open === key}
          aria-expanded={open === key}
          aria-controls={open === key ? `sr-tile-${key}` : undefined}
          onClick={() => onToggle(key)}
          className={`flex min-h-11 flex-col-reverse justify-end rounded-2xl border p-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
            open === key ? "border-sr-ink bg-sr-hud" : "border-sr-soft bg-sr-surface hover:bg-sr-hud"
          }`}
        >
          <span className="mt-3 font-srcond text-xs uppercase tracking-widest text-sr-ink2">{labels[key]}</span>
          <span className="text-5xl font-semibold leading-none tracking-tight text-sr-ink md:text-6xl">
            <CountUp value={stats[key]} playOnMount />
          </span>
        </button>
      ))}
    </div>
  );
}
