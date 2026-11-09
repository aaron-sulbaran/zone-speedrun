"use client";

import { useLayoutEffect, useRef, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import { nextTab, NETWORK_TABS, type NetworkTab } from "@/lib/speedrun/phase";
import { Board } from "../act2/Board";
import { BriefPreview } from "../act2/BriefPreview";
import { Close } from "../act2/Close";
import { Decisions } from "../act2/Decisions";
import { Matches } from "../act2/Matches";
import { NetworkHeader } from "../act2/NetworkHeader";
import { NetworkTabs, panelId, tabId } from "../act2/NetworkTabs";
import { visitorName } from "../visitorName";
import { usePhaseEntrance } from "./usePhaseEntrance";

type NetworkPhaseProps = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  tab: NetworkTab;
  onTab: (tab: NetworkTab) => void;
  onStartOver: () => void;
  onReplayTop: () => void;
};

const NEXT_BUTTON = "rounded-full bg-sr-ink px-6 py-3 font-srcond text-sm uppercase tracking-wider text-sr-surface transition-transform duration-200 ease-sr hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none motion-reduce:hover:translate-y-0";

// Four tabs, one panel on screen. A tab change plays the step enter (forward or back by
// tab order) on the panel only. The egg lives in SpeedrunExperience, so it works on every tab.
export function NetworkPhase({ state, dispatch, tab, onTab, onStartOver, onReplayTop }: NetworkPhaseProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shownTab = useRef(tab);
  usePhaseEntrance(frameRef);

  // Play the step enter when the tab changes, and keep the tablist in view.
  useLayoutEffect(() => {
    const previous = shownTab.current;
    if (previous === tab) return;
    shownTab.current = tab;
    const list = document.querySelector<HTMLElement>("[role=tablist]");
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start", behavior: "instant" });
    const panel = panelRef.current;
    if (!panel || prefersReducedMotion()) return;
    const { stepMs, stepPx } = motion();
    const from = NETWORK_TABS.indexOf(tab) > NETWORK_TABS.indexOf(previous) ? stepPx : -stepPx;
    const enter = panel.animate([{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: stepMs, easing: STEP_EASE });
    return () => enter.cancel();
  }, [tab]);

  if (!state.result) return null;
  const following = nextTab(tab);
  const name = visitorName(state);
  return (
    <div ref={frameRef} data-phase-frame="">
      <div className="px-6 pb-16 pt-24">
        <NetworkHeader name={name} onStartOver={onStartOver} onReplayTop={onReplayTop} />
        <NetworkTabs tab={tab} onTab={onTab} />
        <div key={tab} ref={panelRef} role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} className="mt-10">
          {tab === "matches" && <Matches result={state.result} mentionedFounding={state.answers.founding === true} />}
          {tab === "board" && <Board state={state} dispatch={dispatch} />}
          {tab === "brief" && <BriefPreview state={state} name={name} />}
          {tab === "decisions" && <Decisions />}
          {following && (
            <div className="mx-auto mt-12 flex w-full max-w-3xl">
              <button type="button" onClick={() => onTab(following)} className={NEXT_BUTTON}>
                {speedrunCopy.network.nextTo[tab as Exclude<NetworkTab, "decisions">]}
              </button>
            </div>
          )}
        </div>
      </div>
      <Close />
    </div>
  );
}
