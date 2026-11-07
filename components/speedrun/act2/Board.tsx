"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { introEvents, moveTarget, todayEvents } from "@/lib/speedrun/board";
import { classifyEmail } from "@/lib/speedrun/classify";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { toFlow } from "@/lib/speedrun/funnel";
import { generateInbox, INBOX_TODAY } from "@/lib/speedrun/inbox";
import { PEOPLE } from "@/lib/speedrun/people";
import { buildPipeline } from "@/lib/speedrun/pipeline";
import type { BoardCard } from "@/lib/speedrun/types";
import { FlowChart } from "../FlowChart";
import { ArrangeToggle, CardFrame, HiddenCard, type ControlKind, type ControlRef } from "./BoardControls";
import { BoardStats } from "./BoardStats";
import { BoardTable } from "./BoardTable";
import { ConnectPrompt } from "./ConnectPrompt";
import { IntrosCard, TodayCard } from "./EventCards";
import { PasteEmail } from "./PasteEmail";
import { Rise } from "./Rise";
import { ToolsCard } from "./ToolsCard";
import { useAnnounce } from "./useAnnounce";

const copy = speedrunCopy.board;
function EmptyBody() {
  return <p className="text-sm text-sr-ink2">{copy.emptyBody}</p>;
}

const INBOX_CARDS: BoardCard[] = ["today", "intros", "pipeline", "flow"];

export function Board({ state, dispatch }: { state: DemoState; dispatch: Dispatch<DemoAction> }) {
  const { personKey, inboxConnected: connected, boardOrder, hidden } = state;
  const [arranging, setArranging] = useState(false);
  const [announcement, announce] = useAnnounce();
  // Focus goes back to a control after its card moves or its button swaps, and to the heading after Connect.
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const controlRef: ControlRef = (card, kind) => (element) => {
    if (element) controls.current.set(`${card}:${kind}`, element);
    else controls.current.delete(`${card}:${kind}`);
  };
  const focusAfterUpdate = (card: BoardCard, kind: ControlKind | "heading") => {
    pendingFocus.current = kind === "heading" ? "heading" : `${card}:${kind}`;
  };
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    (target === "heading" ? headingRef.current : controls.current.get(target))?.focus();
  });

  const sampleEvents = useMemo(() => (connected && personKey ? generateInbox(PEOPLE[personKey]).map(classifyEmail) : []), [connected, personKey]);
  const events = useMemo(() => [...sampleEvents, ...state.events], [sampleEvents, state.events]);
  const pipeline = useMemo(() => buildPipeline(events, INBOX_TODAY), [events]);
  const flow = useMemo(() => toFlow(pipeline), [pipeline]);

  const owned = (card: BoardCard): boolean => connected || !INBOX_CARDS.includes(card);
  const shown = boardOrder.filter(owned);
  const hiddenShown = arranging ? hidden.filter(owned) : [];

  const move = (card: BoardCard, direction: -1 | 1) => {
    const to = moveTarget(boardOrder, card, direction);
    if (to === null) return;
    focusAfterUpdate(card, direction === -1 ? "up" : "down");
    dispatch({ type: "moveCard", card, to });
    const rest = boardOrder.filter((other) => other !== card);
    const next = [...rest.slice(0, to), card, ...rest.slice(to)].filter(owned);
    announce(copy.arrange.moved(copy.cardNames[card], next.indexOf(card) + 1, next.length));
  };
  const toggle = (card: BoardCard) => {
    const showing = hidden.includes(card);
    focusAfterUpdate(card, showing ? "hide" : "show");
    dispatch({ type: "toggleCard", card });
    announce((showing ? copy.arrange.shown : copy.arrange.hidden)(copy.cardNames[card]));
  };

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
    <section data-board="" data-connected={connected} aria-labelledby="sr-board-heading" className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 ref={headingRef} id="sr-board-heading" tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink2 focus:outline-none">
            {copy.heading}
          </h3>
          <p className="mt-2 text-lg text-sr-ink2">{copy.subhead}</p>
        </div>
        {connected && <ArrangeToggle arranging={arranging} onToggle={() => setArranging((now) => !now)} />}
      </div>
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <div className="mt-6 space-y-4">
        {!connected && <ConnectPrompt
            onConnect={() => {
              focusAfterUpdate("today", "heading");
              dispatch({ type: "connectInbox", on: true });
            }}
          />}
        {connected && (
          <Rise className="space-y-4">
            <BoardStats stats={pipeline.stats} />
            <PasteEmail existing={state.events} onAdd={(event) => dispatch({ type: "addEvents", events: [event] })} />
          </Rise>
        )}
        {shown.map((card, index) => (
          <CardFrame
            key={card}
            card={card}
            arranging={arranging}
            canUp={index > 0}
            canDown={index < shown.length - 1}
            onMove={(direction) => move(card, direction)}
            onHide={() => toggle(card)}
            controlRef={controlRef}
          >
            {body(card)}
          </CardFrame>
        ))}
        {hiddenShown.map((card) => (
          <HiddenCard key={card} card={card} onShow={() => toggle(card)} controlRef={controlRef} />
        ))}
      </div>
    </section>
  );
}
