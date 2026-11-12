"use client";

import { useLayoutEffect, useRef, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { deskColumns, stageOf, type DeskAction, type DeskState } from "@/lib/speedrun/desk";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import type { NetworkTab, Side } from "@/lib/speedrun/phase";
import { deskFirstName, narrationLine } from "@/lib/speedrun/deskNarration";
import { visitorFirstName } from "../visitorName";
import { ActingAs } from "./ActingAs";
import { DeskBoard } from "./DeskBoard";
import { FullVersion } from "./FullVersion";
import { LearnedStrip } from "./LearnedStrip";
import { Narration } from "./Narration";

const copy = speedrunCopy.team;

type Props = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  desk: DeskState;
  step: (action: DeskAction) => void;
  onSide: (side: Side, tab?: NetworkTab) => void;
};

// The talent team's side of the switch. It reads the visitor's request from DemoState and keeps its own walk in `desk`,
// which NetworkPhase holds so it survives a flip. Its panel scrolls inside the shell; the document never does.
export function Desk({ state, desk, step, onSide }: Props) {
  const root = useRef<HTMLElement>(null);
  const name = deskFirstName(visitorFirstName(state));
  const request = state.introRequest;
  const live = stageOf(request);
  const columns = deskColumns(request, name);
  const key = live === "requested" && request ? request.matchKey : null;

  // A new Requested card arrives with the step enter, then the desk remembers it so a flip back does not replay it.
  useLayoutEffect(() => {
    if (!key || desk.arrivedKey === key) return;
    const card = root.current?.querySelector<HTMLElement>("[data-desk-card][data-mine]");
    if (!card || prefersReducedMotion()) {
      step({ type: "arrived", key });
      return;
    }
    const { stepMs, stepPx } = motion();
    const enter = card.animate([{ opacity: 0, transform: `translateY(${stepPx}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration: stepMs, easing: STEP_EASE });
    enter.onfinish = () => step({ type: "arrived", key });
    return () => {
      enter.onfinish = null;
      enter.cancel();
    };
  }, [key, desk.arrivedKey, step]);

  const line = narrationLine(desk.beat, live, name);
  return (
    <section ref={root} data-desk="" className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6 short-landscape:overflow-visible lg:px-2">
      <h2 tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink focus:outline-none">
        {copy.heading}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-sr-ink2">{copy.intro}</p>
      <div className="mt-4 space-y-3">
        <Narration line={line} />
        <ActingAs who="team" />
      </div>
      <div className="mt-4">
        <DeskBoard
          columns={columns}
          selected={desk.stage}
          nudge={live === null}
          onSelect={(stage) => step({ type: "selectStage", stage })}
          onReview={() => step({ type: "review" })}
          onOpenFounder={() => step({ type: "openFounder" })}
          onMatches={() => onSide("candidate", "matches")}
          onTwoWeeks={() => step({ type: "twoWeeks" })}
        />
      </div>
      <div className="mt-6 space-y-3">
        <LearnedStrip sampleSeen={desk.sampleSeen} />
        <FullVersion />
      </div>
    </section>
  );
}
