import { speedrunCopy } from "@/lib/content";
import { LEARNED, LEARNED_FROM_SAMPLE } from "@/lib/speedrun/deskSamples";

const copy = speedrunCopy.team;

// Patterns the team reviews, not a model retuning itself (Ruling 79). The sample's line joins once the walk reaches it.
export function LearnedStrip({ sampleSeen }: { sampleSeen: boolean }) {
  const lines = sampleSeen ? [...LEARNED, LEARNED_FROM_SAMPLE] : LEARNED;
  return (
    <section data-learned="" aria-labelledby="sr-learned-heading" className="rounded-xl border border-sr-soft bg-sr-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="sr-learned-heading" className="font-srcond text-xs uppercase tracking-widest text-sr-ink">
          {copy.learnedHeading}
        </h3>
        <span className="rounded-full bg-sr-hud px-2 py-0.5 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{copy.sampleLabel}</span>
      </div>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-sr-ink">
        {lines.map((line) => (
          <li key={line} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
