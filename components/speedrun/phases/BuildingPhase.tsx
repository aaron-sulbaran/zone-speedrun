"use client";

import { useRef, useState } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DemoState } from "@/lib/speedrun/demoState";
import type { BuildLine } from "@/lib/speedrun/buildLog";
import { prefersReducedMotion } from "@/lib/speedrun/motion";
import { BuildLog } from "../act2/BuildLog";
import { BuildPlaceholder } from "../act2/BuildPlaceholder";
import { usePhaseEntrance } from "./usePhaseEntrance";

type BuildingPhaseProps = { state: DemoState; lines: BuildLine[]; failed: boolean; onRetry: () => void; onDone: () => void };

export function BuildingPhase({ state, lines, failed, onRetry, onDone }: BuildingPhaseProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);
  usePhaseEntrance(frameRef);
  // Reduced motion shows the log already finished; it waits for a press so it can be read.
  const logDone = (skipped: boolean) => (prefersReducedMotion() && !skipped ? setWaiting(true) : onDone());
  return (
    <div ref={frameRef} data-phase-frame="" className="px-6 py-24">
      <h2 data-phase-heading="" tabIndex={-1} className="sr-only">
        {speedrunCopy.phases.buildingHeading}
      </h2>
      {state.step === "ready" && state.result ? (
        <>
          <BuildLog lines={lines} onDone={logDone} />
          {waiting && (
            <div className="mx-auto mt-8 w-full max-w-2xl">
              <button type="button" onClick={onDone} className="rounded-full bg-sr-ink px-6 py-3 font-srcond text-sm uppercase tracking-wider text-sr-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple">
                {speedrunCopy.build.continue}
              </button>
            </div>
          )}
        </>
      ) : (
        <BuildPlaceholder failed={failed} onRetry={onRetry} />
      )}
    </div>
  );
}
