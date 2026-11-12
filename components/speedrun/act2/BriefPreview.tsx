"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { briefAction, type Action } from "@/lib/speedrun/actions";
import { briefSubject } from "@/lib/speedrun/brief";
import { briefEvents, roleIdsOf, sampleBrief, visitorBrief } from "@/lib/speedrun/briefSample";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { DETAILS } from "@/lib/speedrun/details";
import { INBOX_TODAY } from "@/lib/speedrun/inbox";
import { buildPipeline } from "@/lib/speedrun/pipeline";
import { ActionSheet } from "./ActionSheet";
import { BriefLine } from "./BriefLine";
import { BriefSend } from "./BriefSend";

const copy = speedrunCopy.brief;
const CHANNELS = ["email", "text", "agent"] as const;
type Channel = (typeof CHANNELS)[number];

// The brief as an inbox would show it. It is React over the same Brief data the
// real email renders from, so the preview and the email say the same things.
export function BriefPreview({ state, dispatch, name }: { state: DemoState; dispatch: Dispatch<DemoAction>; name: string }) {
  const { personKey, profile, result, inboxConnected: connected, events: pasted, live } = state;
  const [channel, setChannel] = useState<Channel>("email");
  const [open, setOpen] = useState<Action | null>(null);
  // After a confirm the opener is gone, so focus lands on the line's own "Sent".
  const focusDone = useRef<string | null>(null);
  const firstName = profile?.firstName ?? "";

  // The role line comes from the visitor's own matches, the same ids the sent email is built from.
  const roleIds = useMemo(() => (result ? roleIdsOf(result) : []), [result]);
  const brief = useMemo(() => {
    if (!result) return null;
    if (personKey) return sampleBrief(personKey, { connected, extraEvents: connected ? pasted : [], roleIds });
    return visitorBrief(firstName, connected ? pasted : [], roleIds);
  }, [personKey, connected, pasted, result, firstName, roleIds]);
  const actions = useMemo(() => {
    if (!brief) return [];
    const pipeline = buildPipeline(briefEvents(personKey, connected, pasted), INBOX_TODAY);
    const details = personKey ? DETAILS[personKey] : undefined;
    return brief.items.map((item) => briefAction(item, pipeline, details, INBOX_TODAY));
  }, [brief, personKey, connected, pasted]);
  useEffect(() => {
    const id = focusDone.current;
    if (!id) return;
    focusDone.current = null;
    [...document.querySelectorAll<HTMLElement>("[data-brief-done]")].find((el) => el.dataset.briefDone === id)?.focus();
  }, [state.done]);
  if (!brief || !profile) return null;

  const confirm = (id: string) => {
    if (!open) return;
    dispatch({ type: "markDone", id });
    if (open.matchKey) dispatch({ type: "bringForward", key: open.matchKey, on: true });
    setOpen(null);
    focusDone.current = id;
  };
  const isDone = (action: Action | null) => !!action && (state.done.includes(action.id) || (!!action.matchKey && state.shortlist.includes(action.matchKey)));

  const subject = briefSubject(brief, name);
  const quiet = brief.items.length === 0;

  return (
    <section data-brief="" aria-labelledby="sr-brief-heading" className="mx-auto w-full max-w-3xl lg:mx-0 lg:max-w-none">
      <h3 id="sr-brief-heading" className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">
        {copy.heading}
      </h3>
      <p className="mt-2 text-lg text-sr-ink2">{copy.subhead}</p>

      <article data-brief-email="" aria-label={subject} className="mt-6 max-w-3xl overflow-hidden rounded-2xl bg-sr-surface text-sr-ink">
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
                <BriefLine key={item.text} item={item} action={actions[i]} done={isDone(actions[i])} onOpen={setOpen} />
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
        <p className="mt-3 text-sm text-sr-ink2">{copy.channelNote}</p>
      </div>

      {channel === "email" && <BriefSend live={live.email} personKey={personKey} connected={connected} roleIds={roleIds} />}
      <ActionSheet action={open} onConfirm={confirm} onClose={() => setOpen(null)} />
    </section>
  );
}
