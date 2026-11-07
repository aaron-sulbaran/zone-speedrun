"use client";

import { useMemo, useState } from "react";
import { speedrunCopy } from "@/lib/content";
import { briefSubject } from "@/lib/speedrun/brief";
import { sampleBrief, visitorBrief } from "@/lib/speedrun/briefSample";
import type { DemoState } from "@/lib/speedrun/demoState";
import { BriefSend } from "./BriefSend";

const copy = speedrunCopy.brief;
const CHANNELS = ["email", "text", "agent"] as const;
type Channel = (typeof CHANNELS)[number];

// The brief as an inbox would show it. It is React over the same Brief data the
// real email renders from, so the preview and the email say the same things.
export function BriefPreview({ state }: { state: DemoState }) {
  const { personKey, profile, result, inboxConnected: connected, events: pasted, live } = state;
  const [channel, setChannel] = useState<Channel>("email");
  const firstName = profile?.firstName ?? "";

  const brief = useMemo(() => {
    if (!result) return null;
    if (personKey) return sampleBrief(personKey, { connected, extraEvents: connected ? pasted : [] });
    return visitorBrief(firstName, connected ? pasted : [], result);
  }, [personKey, connected, pasted, result, firstName]);
  if (!brief || !profile) return null;

  const subject = briefSubject(brief, firstName);
  const quiet = brief.items.length === 0;

  return (
    <section data-brief="" aria-labelledby="sr-brief-heading" className="mx-auto w-full max-w-3xl">
      <h3 id="sr-brief-heading" className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">
        {copy.heading}
      </h3>
      <p className="mt-2 text-lg text-sr-ink2">{copy.subhead}</p>

      <article data-brief-email="" aria-label={subject} className="mt-6 overflow-hidden rounded-2xl bg-sr-surface text-sr-ink">
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
          <p className="font-semibold">{copy.greeting(firstName)}</p>
          {quiet ? (
            <p data-brief-quiet="" className="mt-3 text-sr-ink">
              {copy.quietBody}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-sr-soft">
              {brief.items.map((item) => (
                <li key={item.text} data-brief-item={item.kind} className="py-3">
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="underline decoration-sr-ink2 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple">
                      {item.text}
                    </a>
                  ) : (
                    item.text
                  )}
                </li>
              ))}
            </ul>
          )}
          {!connected && <p className="mt-3 text-sm text-sr-ink2">{copy.needsInbox}</p>}
          <p className="mt-5 text-xs text-sr-ink2">{copy.footer}</p>
        </div>
      </article>

      <p data-brief-cadence="" className="mt-4 text-sm text-sr-ink2">
        {copy.cadence[brief.cadence]}
      </p>

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
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
                channel === id ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink hover:bg-sr-strong"
              }`}
            >
              {copy.channels[id]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-sr-ink2">{copy.channelNote}</p>
      </div>

      {channel === "email" && <BriefSend live={live.email} personKey={personKey} connected={connected} />}
    </section>
  );
}
