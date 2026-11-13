import { speedrunCopy } from "@/lib/content";
import type { TileKey } from "@/lib/speedrun/board";
import type { Pipeline } from "@/lib/speedrun/types";
import { CountUp } from "./CountUp";

const TILE_KEYS: TileKey[] = ["applied", "inProcess", "intros", "offers"];

type Props = { stats: Pipeline["stats"]; /** The warm intros the Intros list holds, which are not the same thing as intro emails. */ introCount: number; open: TileKey | null; onToggle: (key: TileKey) => void };

/** The four big numbers, each a toggle. A press opens the tile's list; Applied, In process and Offers also set the table's filter and the next press puts both back, while Intros leaves the filter alone. */
export function BoardStats({ stats, introCount, open, onToggle }: Props) {
  const values: Record<TileKey, number> = { ...stats, intros: introCount };
  const labels = speedrunCopy.board.statLabels;
  return (
    <div data-board-stats="" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          data-stat={key}
          data-value={values[key]}
          aria-expanded={open === key}
          aria-controls={open === key ? `sr-tile-${key}` : undefined}
          onClick={() => onToggle(key)}
          className={`flex min-h-11 flex-col-reverse justify-end rounded-2xl border p-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
            open === key ? "border-sr-ink bg-sr-hud" : "border-sr-soft bg-sr-surface hover:bg-sr-hud"
          }`}
        >
          <span className="mt-3 font-srcond text-xs uppercase tracking-widest text-sr-ink2">{labels[key]}</span>
          <span className="text-5xl font-semibold leading-none tracking-tight text-sr-ink md:text-6xl">
            <CountUp value={values[key]} playOnMount />
          </span>
        </button>
      ))}
    </div>
  );
}
