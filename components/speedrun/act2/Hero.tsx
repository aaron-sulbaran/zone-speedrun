"use client";

import { speedrunCopy } from "@/lib/content";
import { prefersReducedMotion } from "@/lib/speedrun/motion";
import { CountUp } from "./CountUp";

export type DemoStats = { companies: number; roles: number; fetchedAt: string };

function snapshotDay(fetchedAt: string) {
  return new Date(fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const PRIMARY = "min-w-[220px] rounded-lg bg-sr-ink px-6 py-3 text-center font-srcond text-sm font-normal uppercase tracking-wider text-sr-surface";
const GHOST = "min-w-[220px] rounded-lg px-6 py-3 text-center font-srcond text-sm uppercase tracking-wider shadow-[inset_0_0_0_2px_var(--sr-ink)]";
const PRESS = "transition-transform duration-200 ease-sr hover:-translate-y-px active:scale-[.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

export function Hero({ stats, showCtas, onSkip }: { stats: DemoStats; showCtas: boolean; onSkip: () => void }) {
  const copy = speedrunCopy.hero;
  const startDemo = () => {
    const card = document.getElementById("join");
    card?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    card?.focus({ preventScroll: true });
  };
  const figures = [
    { label: copy.stats.companies, node: <CountUp value={stats.companies} /> },
    { label: copy.stats.roles, node: <CountUp value={stats.roles} /> },
    { label: copy.stats.snapshot, node: <span>{snapshotDay(stats.fetchedAt)}</span> },
  ];
  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-12 md:pt-20">
      <p data-cascade="" className="font-srcond text-sm font-normal uppercase tracking-widest text-sr-ink2">{copy.eyebrow}</p>
      <h2 data-cascade="" data-phase-heading="" tabIndex={-1} className="mt-5 text-5xl font-black lowercase leading-[0.98] tracking-tight focus:outline-none md:text-8xl">
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
      <p data-cascade="" className="mt-6 max-w-2xl text-lg font-semibold leading-snug text-sr-ink2 md:text-xl">{copy.lede}</p>
      {showCtas && (
      <div data-cascade="" className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={startDemo} className={`${PRIMARY} ${PRESS}`}>
          {copy.cta}
        </button>
        <button type="button" onClick={onSkip} className={`${GHOST} ${PRESS}`}>
          {copy.ctaSecondary}
        </button>
      </div>
      )}
      <dl data-cascade="" className="mt-14 flex flex-wrap gap-x-12 gap-y-6 border-t border-sr-soft pt-6">
        {figures.map(({ label, node }) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="mt-1 font-srcond text-xs font-normal uppercase tracking-widest text-sr-ink2">{label}</dt>
            <dd className="text-4xl font-black tracking-tight md:text-5xl">{node}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
