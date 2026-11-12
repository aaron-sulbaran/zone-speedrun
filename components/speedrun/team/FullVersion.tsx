import { speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.team.fullVersion;

// The loop as a complete version would run it: twelve steps, who then what, and the notes the page says rather than builds.
export function FullVersion() {
  return (
    <details data-full-version="" className="group rounded-xl border border-sr-soft bg-sr-surface">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-srcond text-xs uppercase tracking-widest text-sr-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple">{copy.summary}</summary>
      <div className="px-4 pb-4">
        <ol aria-label={copy.stepsLabel} className="space-y-3">
          {copy.steps.map((step, index) => (
            <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 text-sm leading-relaxed text-sr-ink">
              <span aria-hidden="true" className="font-srcond text-xs text-sr-ink2">
                {index + 1}
              </span>
              <span className="min-w-0 break-words">
                <span className="font-semibold">{step.who}.</span> {step.what}
              </span>
            </li>
          ))}
        </ol>
        <h4 className="mt-5 font-srcond text-xs uppercase tracking-widest text-sr-ink2">{copy.alsoHeading}</h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-sr-ink">
          {copy.also.map((note) => (
            <li key={note} className="break-words">
              {note}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
