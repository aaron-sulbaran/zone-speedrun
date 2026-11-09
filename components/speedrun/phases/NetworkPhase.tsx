"use client";

import { useRef, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import type { NetworkTab } from "@/lib/speedrun/phase";
import { Board } from "../act2/Board";
import { BriefPreview } from "../act2/BriefPreview";
import { Close } from "../act2/Close";
import { Decisions } from "../act2/Decisions";
import { Matches } from "../act2/Matches";
import { usePhaseEntrance } from "./usePhaseEntrance";

type NetworkPhaseProps = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  tab: NetworkTab;
  onTab: (tab: NetworkTab) => void;
  onStartOver: () => void;
  onReplayTop: () => void;
};

const PLAIN_BUTTON = "rounded-full border border-sr-soft px-5 py-2 font-srcond text-sm uppercase tracking-wider transition-colors duration-200 hover:bg-sr-hud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

// The stacked sections of today, plus the two resets. Task 5 turns this into tabs.
export function NetworkPhase({ state, dispatch, onStartOver, onReplayTop }: NetworkPhaseProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  usePhaseEntrance(frameRef);
  const copy = speedrunCopy.phases;
  if (!state.result) return null;
  return (
    <div ref={frameRef} data-phase-frame="">
      <div className="space-y-16 px-6 pb-24 pt-24">
        <h2 data-phase-heading="" tabIndex={-1} className="sr-only">
          {copy.networkHeading}
        </h2>
        <Matches result={state.result} />
        <Board state={state} dispatch={dispatch} />
        <BriefPreview state={state} />
        <div className="mx-auto flex max-w-3xl flex-wrap gap-3">
          <button type="button" onClick={onStartOver} className={PLAIN_BUTTON}>
            {copy.startOver}
          </button>
          <button type="button" onClick={onReplayTop} className={PLAIN_BUTTON}>
            {copy.replayTop}
          </button>
        </div>
      </div>
      <Decisions />
      <Close />
    </div>
  );
}
