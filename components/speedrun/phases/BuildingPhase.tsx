"use client";

import { useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DemoState } from "@/lib/speedrun/demoState";
import type { BuildLine } from "@/lib/speedrun/buildLog";
import { BuildLog } from "../act2/BuildLog";
import { BuildPlaceholder } from "../act2/BuildPlaceholder";
import { usePhaseEntrance } from "./usePhaseEntrance";

export function BuildingPhase({ state, lines, failed, onRetry, onDone }: { state: DemoState; lines: BuildLine[]; failed: boolean; onRetry: () => void; onDone: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  usePhaseEntrance(frameRef);
  return (
    <div ref={frameRef} data-phase-frame="" className="px-6 py-24">
      <h2 data-phase-heading="" tabIndex={-1} className="sr-only">
        {speedrunCopy.phases.buildingHeading}
      </h2>
      {state.step === "ready" && state.result ? <BuildLog lines={lines} onDone={onDone} /> : <BuildPlaceholder failed={failed} onRetry={onRetry} />}
    </div>
  );
}
