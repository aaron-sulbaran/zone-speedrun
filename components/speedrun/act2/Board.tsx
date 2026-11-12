"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { introCards, needsYou, rowAction, type Action } from "@/lib/speedrun/actions";
import { boardMode, introEvents, tileOfFilter, TILE_FILTER, todayEvents, type BoardFilter, type TileKey } from "@/lib/speedrun/board";
import { classifyEmail } from "@/lib/speedrun/classify";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { DETAILS } from "@/lib/speedrun/details";
import { toFlow } from "@/lib/speedrun/funnel";
import { generateInbox, INBOX_TODAY } from "@/lib/speedrun/inbox";
import { rowKey } from "@/lib/speedrun/keys";
import type { NetworkTab } from "@/lib/speedrun/phase";
import { PEOPLE } from "@/lib/speedrun/people";
import { buildPipeline } from "@/lib/speedrun/pipeline";
import type { BoardCard } from "@/lib/speedrun/types";
import { visitorFirstName } from "../visitorName";
import { FlowChart } from "../FlowChart";
import { CardFrame } from "./BoardControls";
import { BoardEmpty } from "./BoardEmpty";
import { BoardStats } from "./BoardStats";
import { BoardTable } from "./BoardTable";
import { ConnectPrompt } from "./ConnectPrompt";
import { IntrosCard, TodayCard } from "./EventCards";
import { NeedsYou } from "./NeedsYou";
import { PasteEmail } from "./PasteEmail";
import { Rise } from "./Rise";
import { TilePanel } from "./TilePanel";
import { ToolsCard } from "./ToolsCard";
import { useActionSheet } from "./useActionSheet";

const copy = speedrunCopy.board;

export function Board({ state, dispatch, onTab }: { state: DemoState; dispatch: Dispatch<DemoAction>; onTab: (tab: NetworkTab) => void }) {
  const { personKey, inboxConnected: connected } = state;
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [openTile, setOpenTile] = useState<TileKey | null>(null);
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
  const details = personKey ? DETAILS[personKey] : undefined;
  const actions = useMemo(() => {
    const byRow = new Map<string, Action>();
    for (const row of pipeline.rows) {
      const action = rowAction(row, details, INBOX_TODAY);
      if (action) byRow.set(rowKey(row), action);
    }
    return byRow;
  }, [pipeline, details]);
  const needs = useMemo(() => needsYou(pipeline, details, INBOX_TODAY), [pipeline, details]);
  const intros = useMemo(() => introCards(events, state.introRequest, details, INBOX_TODAY), [events, state.introRequest, details]);
  const sheet = useActionSheet(state, dispatch);

  const mode = boardMode(personKey, connected, pipeline.rows.length);
  const firstName = visitorFirstName(state);
  const stillOpen = needs.filter((action) => !sheet.isDone(action)).length;
  const flowTitle = firstName ? copy.flowTitle(firstName) : copy.flowTitleFallback;
  const cards: BoardCard[] = mode === "full" ? ["today", "intros", "tools"] : ["tools"];

  const pressTile = (tile: TileKey) => {
    const closing = openTile === tile;
    setOpenTile(closing ? null : tile);
    setFilter(closing ? "all" : TILE_FILTER[tile]);
  };
  const pressChip = (next: BoardFilter) => {
    setFilter(next);
    setOpenTile(tileOfFilter(next));
  };
  const connect = () => {
    pendingFocus.current = true;
    dispatch({ type: "connectInbox", on: true });
  };

  const body = (card: BoardCard) => {
    if (card === "today") return <TodayCard events={todayEvents(events, INBOX_TODAY)} />;
    if (card === "intros") return <IntrosCard events={introEvents(events)} />;
    return <ToolsCard personKey={personKey} />;
  };

  return (
    <section data-board="" data-connected={connected} aria-labelledby="sr-board-heading" className="mx-auto w-full max-w-5xl lg:mx-0 lg:max-w-none">
      <h3 ref={headingRef} id="sr-board-heading" tabIndex={-1} className="text-2xl font-semibold tracking-tight text-sr-ink focus:outline-none md:text-3xl">
        {copy.heading(personKey ? firstName : null)}
      </h3>
      {mode === "full" && (
        <p data-needs-count="" className="mt-1 text-lg text-sr-ink2">
          {stillOpen > 0 ? copy.count(stillOpen) : copy.allClear}
        </p>
      )}
      <div className="mt-5 space-y-6">
        {mode === "connect" && <ConnectPrompt onConnect={connect} />}
        {mode === "empty" && <BoardEmpty connected={connected} existing={state.events} onConnect={connect} onMatches={() => onTab("matches")} onAdd={(event) => dispatch({ type: "addEvents", events: [event] })} />}
        {mode === "full" && (
          <Rise className="space-y-6">
            <NeedsYou actions={needs} rows={pipeline.rows} isDone={sheet.isDone} pickedFor={sheet.pickedFor} onOpen={sheet.onOpen} />
            <div className="space-y-3">
              <BoardStats stats={pipeline.stats} open={openTile} onToggle={pressTile} />
              {openTile && <TilePanel key={openTile} tile={openTile} rows={pipeline.rows} actions={actions} intros={intros} isDone={sheet.isDone} pickedFor={sheet.pickedFor} onOpen={sheet.onOpen} />}
            </div>
            {/* On the surface colour the chart's label outlines are drawn in; no heading or controls, so it is no longer a card. */}
            <div data-board-flow="" className="rounded-2xl border border-sr-soft bg-sr-surface p-3 md:p-5">
              <FlowChart data={flow} tone="speedrun" animate title={flowTitle} />
            </div>
            <BoardTable rows={pipeline.rows} filter={filter} onFilter={pressChip} actions={actions} isDone={sheet.isDone} pickedFor={sheet.pickedFor} onOpen={sheet.onOpen} />
            <PasteEmail existing={state.events} onAdd={(event) => dispatch({ type: "addEvents", events: [event] })} />
          </Rise>
        )}
        {cards.map((card) => (
          <CardFrame key={card} card={card}>
            {body(card)}
          </CardFrame>
        ))}
      </div>
      {sheet.sheet}
    </section>
  );
}
