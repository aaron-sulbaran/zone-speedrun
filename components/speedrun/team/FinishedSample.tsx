import { speedrunCopy } from "@/lib/content";
import { FINISHED_SAMPLE, LEARNED_FROM_SAMPLE } from "@/lib/speedrun/deskSamples";
import { FILLED } from "../act2/IntroControls";

const copy = speedrunCopy.team;

// Last month's hire, start to finish, with both survey answers (Ruling 78). Every name and line is invented.
export function FinishedSample({ onBack }: { onBack: () => void }) {
  const { card, timeline, survey } = FINISHED_SAMPLE;
  return (
    <div data-finished-sample="" className="space-y-4">
      <div>
        <p className="font-semibold text-sr-ink">{card.firstName}</p>
        <p className="break-words text-sm text-sr-ink2">
          {card.company}, {card.role}
        </p>
        <span className="mt-2 inline-block rounded-full bg-sr-hud px-2 py-0.5 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{card.pill}</span>
      </div>
      <section aria-label={copy.sample.timelineLabel}>
        <ol className="space-y-1.5 border-l border-sr-soft pl-3 text-sm text-sr-ink">
          {timeline.map((item) => (
            <li key={item.label} className="flex flex-wrap justify-between gap-x-3">
              <span>{item.label}</span>
              <span className="text-sr-ink2">{item.when}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <p className="font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{copy.sample.surveyQuestion}</p>
        <dl className="mt-2 space-y-2 text-sm leading-relaxed text-sr-ink">
          <div>
            <dt className="font-semibold">{copy.sample.candidateSays}</dt>
            <dd className="break-words">{survey.candidate}</dd>
          </div>
          <div>
            <dt className="font-semibold">{copy.sample.founderSays}</dt>
            <dd className="break-words">{survey.founder}</dd>
          </div>
        </dl>
        <p className="mt-3 inline-block rounded-full bg-sr-hud px-3 py-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink">{copy.sample.fitHit}</p>
      </section>
      <section data-sample-learned="">
        <p className="font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{copy.sample.learned}</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-sr-ink">{LEARNED_FROM_SAMPLE}</p>
      </section>
      <p className="text-sm font-semibold text-sr-ink">{copy.sample.end}</p>
      <button type="button" onClick={onBack} className={FILLED}>
        {copy.sample.back}
      </button>
    </div>
  );
}
