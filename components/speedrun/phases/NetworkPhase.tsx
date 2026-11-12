"use client";

import { useCallback, useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { deskStep, INITIAL_DESK, stageOf, type DeskAction, type DeskState } from "@/lib/speedrun/desk";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { isLive } from "@/lib/speedrun/introRequest";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import { nextTab, NETWORK_TABS, type NetworkTab, type Side } from "@/lib/speedrun/phase";
import { Board } from "../act2/Board";
import { BriefPreview } from "../act2/BriefPreview";
import { Close } from "../act2/Close";
import { Decisions } from "../act2/Decisions";
import { Matches } from "../act2/Matches";
import { NEXT_LINK, NextArrow, panelId, tabId } from "../act2/NetworkTabs";
import { AppShell } from "../shell/AppShell";
import { Desk } from "../team/Desk";
import { visitorFirstName, visitorName } from "../visitorName";
import { usePhaseEntrance } from "./usePhaseEntrance";

type NetworkPhaseProps = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  tab: NetworkTab;
  side: Side;
  onTab: (tab: NetworkTab) => void;
  onSide: (side: Side, tab?: NetworkTab) => void;
  onStartOver: () => void;
  onReplayTop: () => void;
};

// Four tabs: every panel wrapper exists, a panel's content mounts on first selection and then stays
// (drafts, sent state and toggles survive a switch), and one is visible. A tab change plays the step enter (forward or back by
// tab order) on the panel only. On the team side every panel stays mounted and hidden, so the candidate side returns as left. The egg lives in SpeedrunExperience, so it works on every tab.
export function NetworkPhase({ state, dispatch, tab, side, onTab, onSide, onStartOver, onReplayTop }: NetworkPhaseProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panels = useRef<Partial<Record<NetworkTab, HTMLDivElement | null>>>({});
  const shownTab = useRef(tab);
  // The desk's walk lives here, not in Desk, so it survives a switch flip and resets with the phase (Start over).
  const [desk, setDesk] = useState<DeskState>(INITIAL_DESK);
  const deskRef = useRef(desk);
  const requestRef = useRef(state.introRequest);
  const step = useCallback(
    (action: DeskAction) => {
      const result = deskStep(deskRef.current, requestRef.current, action);
      deskRef.current = result.desk;
      setDesk(result.desk);
      const { effect } = result;
      if (!effect) return;
      if (effect.type === "advance") dispatch({ type: "advanceIntro", to: effect.to });
      else if (effect.type === "sendIntro") dispatch({ type: "sendIntro" });
      else dispatch({ type: "passIntro", by: effect.by });
    },
    [dispatch],
  );
  // Written after commit. This layout effect lives here, not in Desk, because Desk only mounts on the team side: a request
  // that leaves or changes under an open panel while the visitor is on the candidate side must still settle the desk.
  useLayoutEffect(() => {
    const previous = requestRef.current;
    requestRef.current = state.introRequest;
    const live = stageOf(state.introRequest);
    const d = deskRef.current;
    // A request landing in an empty slot (none before, or a passed one) starts the desk at its arrive beat. A pass that hands
    // straight to a next match never goes through the empty slot, so its notNow line stays (Ruling 75).
    const landedInEmptySlot = !isLive(previous) && isLive(state.introRequest);
    if (landedInEmptySlot || (d.panel === "compare" && live !== "requested") || (d.panel === "intro" && live !== "connected") || (d.founderOpen && live !== "withFounder")) step({ type: "settle" });
  }, [state.introRequest, step]);
  usePhaseEntrance(frameRef);
  // A panel mounts on its first selection and stays, so its arrival motion plays in view, once.
  const [visited, setVisited] = useState<ReadonlySet<NetworkTab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

  // The Next button (the matches panel's sits at the end of its list) sits in a panel that is about to hide, so focus moves to the new tab.
  const goTo = (next: NetworkTab) => {
    onTab(next);
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus({ preventScroll: true }));
  };

  // The earned door: across to the talent team's side, with focus on the desk's heading once it has mounted.
  // It selects the live request's stage too, so on a phone the shown column holds the card.
  const openDesk = () => {
    const live = stageOf(state.introRequest);
    if (live) step({ type: "selectStage", stage: live });
    onSide("team");
    requestAnimationFrame(() => frameRef.current?.querySelector<HTMLElement>("[data-desk-heading]")?.focus({ preventScroll: true }));
  };

  // The desk unmounts with the button that was pressed, so the way back puts focus on the tab, as goTo does.
  const deskOnSide = (next: Side, nextTab?: NetworkTab) => {
    onSide(next, nextTab);
    if (next === "candidate") requestAnimationFrame(() => document.getElementById(tabId(nextTab ?? tab))?.focus({ preventScroll: true }));
  };

  // Play the step enter when the tab changes.
  useLayoutEffect(() => {
    const previous = shownTab.current;
    if (previous === tab) return;
    shownTab.current = tab;
    const panel = panels.current[tab];
    if (!panel || prefersReducedMotion()) return;
    const { stepMs, stepPx } = motion();
    const from = NETWORK_TABS.indexOf(tab) > NETWORK_TABS.indexOf(previous) ? stepPx : -stepPx;
    const enter = panel.animate([{ opacity: 0, transform: `translateY(${from}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration: stepMs, easing: STEP_EASE });
    return () => enter.cancel();
  }, [tab]);

  if (!state.result) return null;
  const name = visitorName(state);
  return (
    <div ref={frameRef} data-phase-frame="">
      <AppShell name={visitorFirstName(state)} tab={tab} side={side} onSide={onSide} onTab={onTab} onStartOver={onStartOver} onReplayTop={onReplayTop}>
        {NETWORK_TABS.map((id) => {
          const following = nextTab(id);
          return (
            <div key={id} ref={(node) => void (panels.current[id] = node)} role="tabpanel" id={panelId(id)} aria-labelledby={tabId(id)} hidden={id !== tab || side === "team"} className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6 short-landscape:overflow-visible lg:px-2">
              {visited.has(id) && id === "matches" && <Matches result={state.result!} state={state} dispatch={dispatch} name={visitorFirstName(state)} mentionedFounding={state.answers.founding === true} nextLabel={speedrunCopy.network.nextTo.matches} onNext={() => goTo("board")} onDoor={openDesk} />}
              {visited.has(id) && id === "board" && <Board state={state} dispatch={dispatch} onTab={goTo} />}
              {visited.has(id) && id === "brief" && <BriefPreview state={state} dispatch={dispatch} name={name} />}
              {visited.has(id) && id === "decisions" && (
                <>
                  <Decisions />
                  <Close />
                </>
              )}
              {following && id !== "matches" && (
                <div className="mx-auto mt-12 flex w-full max-w-3xl lg:mx-0 lg:max-w-none">
                  <button type="button" onClick={() => goTo(following)} className={NEXT_LINK}>
                    {speedrunCopy.network.nextTo[id as Exclude<NetworkTab, "matches" | "decisions">]}
                    <NextArrow />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {side === "team" && <Desk state={state} dispatch={dispatch} desk={desk} step={step} onSide={deskOnSide} />}
      </AppShell>
    </div>
  );
}
