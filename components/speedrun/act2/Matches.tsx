"use client";

import { useEffect, useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import type { MatchResult } from "@/lib/speedrun/match";
import { prefersReducedMotion, SR_EASE } from "@/lib/speedrun/motion";
import { FounderRoute } from "./FounderRoute";
import { MatchCard } from "./MatchCard";

const CASCADE_MS = 420;
const STAGGER_MS = 70;
const MAX_STAGGERED = 8;

export function Matches({ result, mentionedFounding = false }: { result: MatchResult; mentionedFounding?: boolean }) {
  const copy = speedrunCopy.matches;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const targets = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-founder-route], [data-match-card]") ?? [])];
    const running = targets.map((el, i) =>
      el.animate(
        [
          { opacity: 0, transform: "translateY(10px) scale(.99)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: CASCADE_MS, delay: Math.min(i, MAX_STAGGERED) * STAGGER_MS, easing: SR_EASE, fill: "backwards" },
      ),
    );
    return () => running.forEach((animation) => animation.cancel());
  }, []);

  return (
    <section data-matches="" aria-labelledby="sr-matches-heading" className="mx-auto w-full max-w-3xl">
      <h3 id="sr-matches-heading" className="font-srcond text-sm uppercase tracking-widest text-sr-purple">
        {copy.heading}
      </h3>
      <p className="mt-2 text-lg text-sr-ink2">{copy.subhead}</p>
      <div ref={listRef} className="mt-6 space-y-4">
        <FounderRoute routes={result.routes} mentioned={mentionedFounding} />
        {result.matches.length === 0 ? (
          <p data-matches-empty="" className="rounded-xl border border-sr-soft bg-sr-surface p-6 text-sr-ink2">
            {copy.empty}
          </p>
        ) : (
          <ul className="space-y-4">
            {result.matches.map((match) => (
              <MatchCard key={`${match.company.name}-${match.role?.id ?? "company"}`} match={match} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
