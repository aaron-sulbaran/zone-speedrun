"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { deskColumns, stageOf, type DeskAction, type DeskState } from "@/lib/speedrun/desk";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import type { NetworkTab, Side } from "@/lib/speedrun/phase";
import { deskFirstName, narrationLine } from "@/lib/speedrun/deskNarration";
import { rivalById } from "@/lib/speedrun/deskSamples";
import { visitorFirstName } from "../visitorName";
import { ActingAs } from "./ActingAs";
import { CompareDrawer } from "./CompareDrawer";
import { DeskBoard } from "./DeskBoard";
import { DeskPanel } from "./DeskPanel";
import { FinishedSample } from "./FinishedSample";
import { FounderPanel } from "./FounderPanel";
import { IntroDraft } from "./IntroDraft";
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

  // A panel is only open while the live request still fits it. A candidate-side removal or pass closes it; a swap
  // keeps the compare drawer open on the new match, because the panels read the request on every render.
  const compareFits = live === "requested";
  const introFits = live === "connected";
  const founderFits = live === "withFounder";
  // NetworkPhase settles a panel whose request left; these guards only keep one from rendering in the frame before it does.
  // Whatever closes a panel (Escape, the close button, a refused move) hands focus back to the visitor's card.
  const isOpen = desk.panel !== null || desk.founderOpen;
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const card = root.current?.querySelector<HTMLElement>("[data-desk-card][data-mine]");
      (card?.querySelector<HTMLElement>("button") ?? card ?? root.current?.querySelector<HTMLElement>("h2"))?.focus({ preventScroll: true });
    }
    wasOpen.current = isOpen;
  }, [isOpen]);
  const closePanel = useCallback(() => step({ type: "closePanel" }), [step]);

  const line = narrationLine(desk.beat, live, name, rivalById(desk.rivalSent)?.firstName ?? "");
  return (
    <div className="relative h-full overflow-x-clip">
      <section ref={root} data-desk="" className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6 short-landscape:overflow-visible lg:px-2">
        <h2 data-desk-heading="" tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink focus:outline-none">
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
            onOpenIntro={() => step({ type: "openIntro" })}
            introSent={!!request?.introSent}
            onMatches={() => onSide("candidate", "matches")}
            onTwoWeeks={() => step({ type: "twoWeeks" })}
          />
        </div>
        <div className="mt-6 space-y-3">
          <LearnedStrip sampleSeen={desk.sampleSeen} />
          <FullVersion />
        </div>
      </section>
      {desk.panel === "compare" && compareFits && request && (
        <DeskPanel mode="compare" heading={copy.compare.heading} about={copy.compare.about(request.match.company.name, request.match.role?.title ?? "")} line={line} onClose={closePanel}>
          <CompareDrawer request={request} step={step} />
        </DeskPanel>
      )}
      {desk.panel === "intro" && introFits && request && (
        <DeskPanel mode="intro" heading={copy.introDraft.heading} line={line} onClose={closePanel}>
          <IntroDraft request={request} step={step} />
        </DeskPanel>
      )}
      {desk.panel === "sample" && (
        <DeskPanel mode="sample" heading={copy.sample.heading} line={line} onClose={closePanel}>
          <FinishedSample
            onBack={() => {
              closePanel();
              onSide("candidate");
            }}
          />
        </DeskPanel>
      )}
      {desk.founderOpen && founderFits && request && <FounderPanel request={request} line={line} step={step} />}
    </div>
  );
}
