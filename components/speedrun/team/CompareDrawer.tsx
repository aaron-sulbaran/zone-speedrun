import { speedrunCopy } from "@/lib/content";
import type { DeskAction } from "@/lib/speedrun/desk";
import { candidateName, deskFit } from "@/lib/speedrun/deskNarration";
import { rivalsFor } from "@/lib/speedrun/deskSamples";
import type { IntroRequest } from "@/lib/speedrun/introRequest";
import { FILLED, SECONDARY } from "../act2/IntroControls";

const copy = speedrunCopy.team;

type Person = { name: string; headline: string; whyThem: string; whyRole: string; project: string };

function Fact({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div>
      <dt className="font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{label}</dt>
      <dd className="mt-0.5 break-words text-sm leading-relaxed text-sr-ink">{text}</dd>
    </div>
  );
}

function PersonCard({ person, kind, labelId, children }: { person: Person; kind: "mine" | "rival"; labelId: string; children: React.ReactNode }) {
  return (
    <article data-compare-person={kind} aria-labelledby={labelId} className={`rounded-xl border bg-sr-surface p-3 ${kind === "mine" ? "border-2 border-sr-ink" : "border-sr-soft"}`}>
      {kind === "mine" && <p className="mb-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink">{copy.compare.suggested}</p>}
      <p id={labelId} data-compare-name="" className="break-words font-semibold text-sr-ink">
        {person.name}
      </p>
      {person.headline && <p className="break-words text-sm text-sr-ink2">{person.headline}</p>}
      <dl className="mt-3 space-y-2">
        <Fact label={copy.compare.whyThem} text={person.whyThem} />
        <Fact label={copy.compare.whyRole} text={person.whyRole} />
        <Fact label={copy.compare.project} text={person.project} />
      </dl>
      <div className="mt-3">{children}</div>
    </article>
  );
}

// The visitor beside the two others who spent their pick on this role (Ruling 74). Splits suggests the visitor.
export function CompareDrawer({ request, step }: { request: IntroRequest; step: (action: DeskAction) => void }) {
  const name = candidateName(request);
  const mine: Person = { name, headline: request.candidate.headline, ...deskFit(request), project: request.candidate.shipped[0] ?? "" };
  return (
    <div className="space-y-3">
      <PersonCard person={mine} kind="mine" labelId="sr-compare-mine">
        <button type="button" onClick={() => step({ type: "send" })} className={FILLED}>
          {copy.compare.send(name)}
        </button>
      </PersonCard>
      {rivalsFor(request.match).map((rival) => (
        <PersonCard key={rival.id} person={{ name: rival.firstName, headline: rival.headline, whyThem: rival.whyThem, whyRole: rival.whyRole, project: rival.project }} kind="rival" labelId={`sr-compare-${rival.id}`}>
          <button type="button" aria-describedby={`sr-compare-${rival.id}`} onClick={() => step({ type: "sendInstead", rivalId: rival.id })} className={SECONDARY}>
            {copy.compare.sendInstead}
          </button>
        </PersonCard>
      ))}
    </div>
  );
}
