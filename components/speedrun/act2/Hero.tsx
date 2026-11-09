"use client";

import { speedrunCopy } from "@/lib/content";
import { CountUp } from "./CountUp";

export type DemoStats = { companies: number; roles: number; fetchedAt: string };

function snapshotDay(fetchedAt: string) {
  return new Date(fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const GHOST = "rounded-lg px-6 py-3 text-center font-srcond text-sm uppercase tracking-wider shadow-[inset_0_0_0_2px_var(--sr-ink)]";
const PRESS = "transition-transform duration-200 ease-sr hover:-translate-y-px active:scale-[.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

export function SkipButton({ onSkip, className = "" }: { onSkip: () => void; className?: string }) {
  return (
    <button type="button" onClick={onSkip} className={`${GHOST} ${PRESS} ${className}`}>
      {speedrunCopy.hero.ctaSecondary}
    </button>
  );
}

// The left column beside the join card. Below `lg` only the eyebrow and headline
// stay (CSS, not JS, so the server and client agree); the skip button then sits under the card.
export function Hero({ stats, onSkip }: { stats: DemoStats; onSkip: () => void }) {
  const copy = speedrunCopy.hero;
  const figures = [
    { label: copy.stats.companies, node: <CountUp value={stats.companies} /> },
    { label: copy.stats.roles, node: <CountUp value={stats.roles} /> },
    { label: copy.stats.snapshot, node: <span>{snapshotDay(stats.fetchedAt)}</span> },
  ];
  return (
    <div className="min-w-0 pb-8 lg:pb-0 lg:pt-6">
      <p data-cascade="" className="font-srcond text-sm font-normal uppercase tracking-widest text-sr-ink2">{copy.eyebrow}</p>
      <h2 data-cascade="" data-phase-heading="" tabIndex={-1} className="mt-4 text-4xl font-black lowercase leading-[0.98] tracking-tight focus:outline-none sm:text-5xl lg:mt-5 lg:text-6xl xl:text-7xl">
        {copy.headline.map((part, index) =>
          part.em ? (
            <em key={index} className="italic">
              {part.text}
            </em>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </h2>
      <p data-cascade="" className="mt-6 hidden max-w-xl text-lg font-semibold leading-snug text-sr-ink2 lg:block xl:text-xl">{copy.lede}</p>
      <dl data-cascade="" className="mt-10 hidden flex-wrap gap-x-10 gap-y-6 border-t border-sr-soft pt-6 lg:flex">
        {figures.map(({ label, node }) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="mt-1 font-srcond text-xs font-normal uppercase tracking-widest text-sr-ink2">{label}</dt>
            <dd className="text-4xl font-black tracking-tight">{node}</dd>
          </div>
        ))}
      </dl>
      <div data-cascade="" className="mt-6 hidden lg:block">
        <SkipButton onSkip={onSkip} />
      </div>
    </div>
  );
}
