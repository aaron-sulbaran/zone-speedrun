import { speedrunCopy } from "@/lib/content";
import type { Pipeline } from "@/lib/speedrun/types";
import { CountUp } from "./CountUp";

const KEYS = ["applied", "inProcess", "intros", "offers"] as const;

export function BoardStats({ stats }: { stats: Pipeline["stats"] }) {
  const labels = speedrunCopy.board.statLabels;
  return (
    <dl data-board-stats="" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {KEYS.map((key) => (
        <div key={key} data-stat={key} data-value={stats[key]} className="rounded-2xl border border-sr-soft bg-sr-surface p-5">
          <dd className="text-5xl font-semibold leading-none tracking-tight text-sr-ink md:text-6xl">
            <CountUp value={stats[key]} />
          </dd>
          <dt className="mt-3 font-srcond text-xs uppercase tracking-widest text-sr-ink2">{labels[key]}</dt>
        </div>
      ))}
    </dl>
  );
}
