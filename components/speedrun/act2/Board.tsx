"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { introCards, needsYou, rowAction, todayItems, type Action } from "@/lib/speedrun/actions";
import { boardMode, tileOfFilter, TILE_FILTER, type BoardFilter, type TileKey } from "@/lib/speedrun/board";
import { classifyEmail } from "@/lib/speedrun/classify";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { detailsFor } from "@/lib/speedrun/details";
import { toFlow } from "@/lib/speedrun/funnel";
import { generateInbox } from "@/lib/speedrun/inbox";
import { rowKey } from "@/lib/speedrun/keys";
import type { NetworkTab } from "@/lib/speedrun/phase";
import { PEOPLE } from "@/lib/speedrun/people";
import { buildPipeline } from "@/lib/speedrun/pipeline";
import { demoToday } from "@/lib/speedrun/today";
import { visitorFirstName } from "../visitorName";
import { FlowChart } from "../FlowChart";
import { BoardSection } from "./BoardSection";
import { BoardEmpty } from "./BoardEmpty";
import { BoardStats } from "./BoardStats";
import { BoardTable } from "./BoardTable";
import { ConnectPrompt } from "./ConnectPrompt";
import { NeedsYou } from "./NeedsYou";
import { Rise } from "./Rise";
import { Shortlist } from "./Shortlist";
import { TodayList } from "./TodayList";
import { TilePanel } from "./TilePanel";
import { ToolsCard } from "./ToolsCard";
import { WarmIntros } from "./WarmIntros";
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

  // The board's dates need a connected inbox, so they exist only after the visitor acts and never in server HTML.
  const today = useMemo(() => demoToday(), []);
  const events = useMemo(() => (connected && personKey ? generateInbox(PEOPLE[personKey], 1, today).map(classifyEmail) : []), [connected, personKey, today]);
  const pipeline = useMemo(() => buildPipeline(events, today), [events, today]);
  const flow = useMemo(() => toFlow(pipeline), [pipeline]);
  const details = useMemo(() => (personKey ? detailsFor(today)[personKey] : undefined), [personKey, today]);
  const actions = useMemo(() => {
    const byRow = new Map<string, Action>();
    for (const row of pipeline.rows) {
      const action = rowAction(row, details, today);
      if (action) byRow.set(rowKey(row), action);
    }
    return byRow;
  }, [pipeline, details, today]);
  const needs = useMemo(() => needsYou(pipeline, details, today), [pipeline, details, today]);
  const todays = useMemo(() => todayItems(events, details, today), [events, details, today]);
  const intros = useMemo(() => introCards(events, state.introRequest, details, today), [events, state.introRequest, details, today]);
  const sheet = useActionSheet(state, dispatch);

  const mode = boardMode(personKey, connected, pipeline.rows.length);
  const firstName = visitorFirstName(state);
  const stillOpen = needs.filter((action) => !sheet.isDone(action)).length;
  const flowTitle = firstName ? copy.flowTitle(firstName) : copy.flowTitleFallback;

  const pressTile = (tile: TileKey) => {
    const closing = openTile === tile;
    setOpenTile(closing ? null : tile);
    // Applied, In process and Offers open their list and set the table's filter (a second press clears both); Intros opens its list and leaves the filter where it was.
    const filters = TILE_FILTER[tile];
    if (filters) setFilter(closing ? "all" : filters);
  };
  const pressChip = (next: BoardFilter) => {
    setFilter(next);
    // A chip that has its own tile (In process, Offers) opens that tile and closes any other panel, one at a time. All and Closed have no tile: they close a filter tile's panel (its filter just changed) but keep the Intros list, which has nothing to do with the filter.
    setOpenTile((open) => tileOfFilter(next) ?? (open === "intros" ? open : null));
  };
  const connect = () => {
    pendingFocus.current = true;
    dispatch({ type: "connectInbox", on: true });
  };

  const toMatches = () => onTab("matches");
  const shared = { isDone: sheet.isDone, pickedFor: sheet.pickedFor, onOpen: sheet.onOpen };

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
        {mode === "empty" && <BoardEmpty connected={connected} onConnect={connect} onMatches={toMatches} />}
        {mode === "full" && (
          <Rise className="space-y-6">
            <NeedsYou actions={needs} rows={pipeline.rows} isDone={sheet.isDone} pickedFor={sheet.pickedFor} onOpen={sheet.onOpen} />
            <div className="space-y-3">
              <BoardStats stats={pipeline.stats} introCount={intros.length} open={openTile} onToggle={pressTile} />
              {openTile && <TilePanel key={openTile} tile={openTile} rows={pipeline.rows} actions={actions} intros={intros} isDone={sheet.isDone} pickedFor={sheet.pickedFor} onOpen={sheet.onOpen} />}
            </div>
            {/* On the surface colour the chart's label outlines are drawn in; no heading or controls, so it is no longer a card. */}
            <div data-board-flow="" className="rounded-2xl border border-sr-soft bg-sr-surface p-3 md:p-5">
              <FlowChart data={flow} tone="speedrun" animate title={flowTitle} />
            </div>
            <BoardTable rows={pipeline.rows} filter={filter} onFilter={pressChip} actions={actions} isDone={sheet.isDone} pickedFor={sheet.pickedFor} onOpen={sheet.onOpen} />
          </Rise>
        )}
        {mode === "full" && (
          <>
            <BoardSection id="today" heading={copy.today.heading}>
              <TodayList items={todays} {...shared} />
            </BoardSection>
            <BoardSection id="intros" heading={copy.intros.heading}>
              <WarmIntros cards={intros} onMatches={toMatches} {...shared} />
            </BoardSection>
          </>
        )}
        {/* The empty board's own line already points to Matches, so there the Shortlist waits for its first pick. Connect mode has no such line. */}
        {(mode !== "empty" || state.shortlist.length > 0) && (
          <BoardSection id="shortlist" heading={copy.shortlist.heading}>
            <Shortlist keys={state.shortlist} matches={state.result?.matches ?? []} request={state.introRequest} dispatch={dispatch} onMatches={toMatches} />
          </BoardSection>
        )}
        <BoardSection id="tools" heading={copy.tools.heading}>
          <ToolsCard personKey={personKey} />
        </BoardSection>
      </div>
      {sheet.sheet}
    </section>
  );
}
