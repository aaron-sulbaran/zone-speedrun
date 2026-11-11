"use client";

import { useEffect, useMemo, useRef, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { introEvents, todayEvents } from "@/lib/speedrun/board";
import { classifyEmail } from "@/lib/speedrun/classify";
import { DEFAULT_BOARD_ORDER, type DemoAction, type DemoState } from "@/lib/speedrun/demoState";
import { toFlow } from "@/lib/speedrun/funnel";
import { generateInbox, INBOX_TODAY } from "@/lib/speedrun/inbox";
import { PEOPLE } from "@/lib/speedrun/people";
import { buildPipeline } from "@/lib/speedrun/pipeline";
import type { BoardCard } from "@/lib/speedrun/types";
import { FlowChart } from "../FlowChart";
import { CardFrame } from "./BoardControls";
import { BoardStats } from "./BoardStats";
import { BoardTable } from "./BoardTable";
import { ConnectPrompt } from "./ConnectPrompt";
import { IntrosCard, TodayCard } from "./EventCards";
import { PasteEmail } from "./PasteEmail";
import { Rise } from "./Rise";
import { ToolsCard } from "./ToolsCard";

const copy = speedrunCopy.board;
function EmptyBody() {
  return <p className="text-sm text-sr-ink2">{copy.emptyBody}</p>;
}

const INBOX_CARDS: BoardCard[] = ["today", "intros", "pipeline", "flow"];

export function Board({ state, dispatch }: { state: DemoState; dispatch: Dispatch<DemoAction> }) {
  const { personKey, inboxConnected: connected } = state;
  // Focus returns to the heading after Connect swaps the prompt out.
  const pendingFocus = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    headingRef.current?.focus();
  });

  const sampleEvents = useMemo(() => (connected && personKey ? generateInbox(PEOPLE[personKey]).map(classifyEmail) : []), [connected, personKey]);
  const events = useMemo(() => [...sampleEvents, ...state.events], [sampleEvents, state.events]);
  const pipeline = useMemo(() => buildPipeline(events, INBOX_TODAY), [events]);
  const flow = useMemo(() => toFlow(pipeline), [pipeline]);

  const shown = DEFAULT_BOARD_ORDER.filter((card) => connected || !INBOX_CARDS.includes(card));

  const firstName = state.profile?.firstName.trim();
  const flowTitle = firstName ? copy.flowTitle(firstName) : copy.flowTitleFallback;

  const body = (card: BoardCard) => {
    switch (card) {
      case "today":
        return <TodayCard events={todayEvents(events, INBOX_TODAY)} />;
      case "intros":
        return <IntrosCard events={introEvents(events)} />;
      case "tools":
        return <ToolsCard personKey={personKey} />;
      case "pipeline":
        return pipeline.rows.length > 0 ? <BoardTable rows={pipeline.rows} /> : <EmptyBody />;
      case "flow":
        return flow.nodes.length > 0 ? <FlowChart data={flow} tone="speedrun" animate title={flowTitle} /> : <EmptyBody />;
    }
  };

  return (
    <section data-board="" data-connected={connected} aria-labelledby="sr-board-heading" className="mx-auto w-full max-w-5xl lg:mx-0 lg:max-w-none">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 ref={headingRef} id="sr-board-heading" tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink2 focus:outline-none">
            {copy.heading}
          </h3>
          <p className="mt-2 text-lg text-sr-ink2">{copy.subhead}</p>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {!connected && <ConnectPrompt
            onConnect={() => {
              pendingFocus.current = true;
              dispatch({ type: "connectInbox", on: true });
            }}
          />}
        {connected && (
          <Rise className="space-y-4">
            <BoardStats stats={pipeline.stats} />
            <PasteEmail existing={state.events} onAdd={(event) => dispatch({ type: "addEvents", events: [event] })} />
          </Rise>
        )}
        {shown.map((card) => (
          <CardFrame key={card} card={card}>
            {body(card)}
          </CardFrame>
        ))}
      </div>
    </section>
  );
}
