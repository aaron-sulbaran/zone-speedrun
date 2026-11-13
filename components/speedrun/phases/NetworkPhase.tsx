"use client";

import { useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import { nextTab, NETWORK_TABS, type NetworkTab } from "@/lib/speedrun/phase";
import { Board } from "../act2/Board";
import { BriefPreview } from "../act2/BriefPreview";
import { Close } from "../act2/Close";
import { Decisions } from "../act2/Decisions";
import { Matches } from "../act2/Matches";
import { NEXT_LINK, NextArrow, panelId, tabId } from "../act2/NetworkTabs";
import { AppShell } from "../shell/AppShell";
import { visitorFirstName, visitorName } from "../visitorName";
import { usePhaseEntrance } from "./usePhaseEntrance";

type NetworkPhaseProps = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  tab: NetworkTab;
  onTab: (tab: NetworkTab) => void;
  onStartOver: () => void;
  onReplayTop: () => void;
};

// Four tabs: every panel wrapper exists, a panel's content mounts on first selection and then stays
// (drafts, sent state and toggles survive a switch), and one is visible. A tab change plays the step enter (forward or back by
// tab order) on the panel only. The egg lives in SpeedrunExperience, so it works on every tab.
export function NetworkPhase({ state, dispatch, tab, onTab, onStartOver, onReplayTop }: NetworkPhaseProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panels = useRef<Partial<Record<NetworkTab, HTMLDivElement | null>>>({});
  const shownTab = useRef(tab);
  usePhaseEntrance(frameRef);
  // A panel mounts on its first selection and stays, so its arrival motion plays in view, once.
  const [visited, setVisited] = useState<ReadonlySet<NetworkTab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

  // The Next button (the matches panel's sits at the end of its list) sits in a panel that is about to hide, so focus moves to the new tab.
  const goTo = (next: NetworkTab) => {
    onTab(next);
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus({ preventScroll: true }));
  };

  // "Your Board" in a Matches hint is about the shortlist: land on it, and let its heading say where the reader is.
  const toShortlist = () => {
    onTab("board");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const heading = document.getElementById("sr-section-shortlist");
        heading?.scrollIntoView({ block: "start", behavior: "instant" });
        heading?.focus({ preventScroll: true });
      }),
    );
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
      <AppShell name={visitorFirstName(state)} tab={tab} onTab={onTab} onStartOver={onStartOver} onReplayTop={onReplayTop}>
        {NETWORK_TABS.map((id) => {
          const following = nextTab(id);
          return (
            <div key={id} ref={(node) => void (panels.current[id] = node)} role="tabpanel" id={panelId(id)} aria-labelledby={tabId(id)} hidden={id !== tab} className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6 short-landscape:overflow-visible lg:px-2">
              {visited.has(id) && id === "matches" && <Matches result={state.result!} state={state} dispatch={dispatch} name={visitorFirstName(state)} mentionedFounding={state.answers.founding === true} nextLabel={speedrunCopy.network.nextTo.matches} onNext={() => goTo("board")} onShortlist={toShortlist} />}
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
      </AppShell>
    </div>
  );
}
