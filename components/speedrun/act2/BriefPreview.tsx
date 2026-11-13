"use client";

import { useMemo, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { briefAction } from "@/lib/speedrun/actions";
import { briefSubject } from "@/lib/speedrun/brief";
import { demoToday } from "@/lib/speedrun/today";
import { briefEvents, roleIdsOf, sampleBrief, visitorBrief } from "@/lib/speedrun/briefSample";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { detailsFor } from "@/lib/speedrun/details";
import { buildPipeline } from "@/lib/speedrun/pipeline";
import { BriefLine } from "./BriefLine";
import { BriefSend } from "./BriefSend";
import { useActionSheet } from "./useActionSheet";

const copy = speedrunCopy.brief;
const CHANNELS = ["email", "text", "agent"] as const;
type Channel = (typeof CHANNELS)[number];

// The brief as an inbox would show it. It is React over the same Brief data the
// real email renders from, so the preview and the email say the same things.
export function BriefPreview({ state, dispatch, name }: { state: DemoState; dispatch: Dispatch<DemoAction>; name: string }) {
  const { personKey, profile, result, inboxConnected: connected, live } = state;
  const [channel, setChannel] = useState<Channel>("email");
  const sheet = useActionSheet(state, dispatch);
  const firstName = profile?.firstName ?? "";

  // The role line comes from the visitor's own matches, the same ids the sent email is built from.
  const roleIds = useMemo(() => (result ? roleIdsOf(result) : []), [result]);
  // The brief only renders once the visitor has results, long after mount, so the date never reaches server HTML.
  const today = useMemo(() => demoToday(), []);
  const brief = useMemo(() => {
    if (!result) return null;
    if (personKey) return sampleBrief(personKey, { connected, roleIds, today });
    return visitorBrief(firstName, roleIds, today);
  }, [personKey, connected, result, firstName, roleIds, today]);
  const actions = useMemo(() => {
    if (!brief) return [];
    const pipeline = buildPipeline(briefEvents(personKey, connected, today), today);
    const details = personKey ? detailsFor(today)[personKey] : undefined;
    return brief.items.map((item) => briefAction(item, pipeline, details, today));
  }, [brief, personKey, connected, today]);
  if (!brief || !profile) return null;

  const subject = briefSubject(brief, name);
  const quiet = brief.items.length === 0;

  return (
    <section data-brief="" aria-labelledby="sr-brief-heading" className="mx-auto w-full max-w-3xl lg:mx-0 lg:max-w-none">
      <h3 id="sr-brief-heading" className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">
        {copy.heading}
      </h3>
      <p className="mt-2 text-lg text-sr-ink2">{copy.subhead}</p>

      <article data-brief-email="" aria-label={subject} className="mt-6 max-w-xl overflow-hidden rounded-2xl bg-sr-surface text-sr-ink">
        <header className="border-b border-sr-soft px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-semibold">{copy.from}</p>
            <p className="shrink-0 text-xs text-sr-ink2">{copy.time}</p>
          </div>
          <h4 data-brief-subject="" className="mt-1 text-base font-semibold">
            {subject}
          </h4>
        </header>
        <div className="px-5 py-5">
          <p className="font-semibold">{copy.greeting(name)}</p>
          {quiet ? (
            <p data-brief-quiet="" className="mt-3 text-sr-ink">
              {copy.quietBody}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-sr-soft">
              {brief.items.map((item, i) => (
                <BriefLine key={item.text} item={item} action={actions[i]} done={!!actions[i] && sheet.isDone(actions[i]!)} picked={actions[i] ? sheet.pickedFor(actions[i]!) : undefined} onOpen={sheet.onOpen} />
              ))}
            </ul>
          )}
          {!connected && <p className="mt-3 text-sm text-sr-ink2">{copy.needsInbox}</p>}
          <p className="mt-5 text-xs text-sr-ink2">{copy.footer}</p>
        </div>
      </article>

      <div role="group" aria-labelledby="sr-brief-cadence-label" className="mt-6">
        <p id="sr-brief-cadence-label" data-brief-cadence-label="" className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">
          {copy.cadenceLabel}
        </p>
        <p data-brief-cadence="" className="mt-3 text-base text-sr-ink">
          {copy.cadence[brief.cadence]}
        </p>
      </div>

      <div className="mt-6">
        <p id="sr-brief-channels" className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">
          {copy.channels.label}
        </p>
        <div role="group" aria-labelledby="sr-brief-channels" className="mt-3 flex flex-wrap gap-2">
          {CHANNELS.map((id) => (
            <button
              key={id}
              type="button"
              data-channel={id}
              aria-pressed={channel === id}
              onClick={() => setChannel(id)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
                channel === id ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink hover:bg-sr-strong"
              }`}
            >
              {copy.channels[id]}
            </button>
          ))}
        </div>
        <p data-brief-channel-note="" className="mt-3 text-sm text-sr-ink2">
          {live.email ? copy.channelNoteLive : copy.channelNote}
        </p>
      </div>

      {channel === "email" && <BriefSend live={live.email} personKey={personKey} connected={connected} roleIds={roleIds} />}
      {sheet.sheet}
    </section>
  );
}
