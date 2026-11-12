import { speedrunCopy } from "@/lib/content";
import type { DeskAction } from "@/lib/speedrun/desk";
import { candidateName, deskFit } from "@/lib/speedrun/deskNarration";
import type { IntroRequest } from "@/lib/speedrun/introRequest";
import { FILLED, SECONDARY } from "../act2/IntroControls";

const copy = speedrunCopy.team;

// The warm intro Splits drafted once the founder said yes (Ruling 77). Sending is the team's second gate; once sent
// the button keeps its place (so focus stays) and reads as done, and the way to the finished sample appears.
export function IntroDraft({ request, step }: { request: IntroRequest; step: (action: DeskAction) => void }) {
  const name = candidateName(request);
  const company = request.match.company.name;
  const sent = request.introSent;
  return (
    <div data-intro-draft="" className="space-y-3">
      <dl className="space-y-1 text-sm text-sr-ink">
        <div className="flex gap-2">
          <dt className="font-srcond text-[11px] uppercase leading-5 tracking-widest text-sr-ink2">{copy.introDraft.to}</dt>
          <dd className="min-w-0 break-words">
            {copy.introDraft.toFounder(company)}, {name}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-srcond text-[11px] uppercase leading-5 tracking-widest text-sr-ink2">{copy.introDraft.copied}</dt>
          <dd>{copy.introDraft.copiedTeam}</dd>
        </div>
      </dl>
      <p className="break-words rounded-xl bg-sr-bg p-3 text-sm leading-relaxed text-sr-ink">{copy.introDraft.body(name, company, request.match.role?.title ?? "", deskFit(request).whyThem)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-disabled={sent} onClick={() => !sent && step({ type: "sendIntro" })} className={`${sent ? SECONDARY : FILLED} aria-disabled:cursor-default`}>
          {sent ? copy.introDraft.sent : copy.introDraft.send}
        </button>
        {sent && (
          <button type="button" onClick={() => step({ type: "twoWeeks" })} className={FILLED}>
            {copy.twoWeeks}
          </button>
        )}
      </div>
    </div>
  );
}
