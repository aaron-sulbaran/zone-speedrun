"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { demoReducer, initialDemoState, type Live } from "@/lib/speedrun/demoState";
import { INITIAL_PHASE, phaseEventFor, phaseReducer } from "@/lib/speedrun/phase";
import { PinnedAffiliation } from "./PinnedAffiliation";
import { Switch } from "./Shift";
import { SrZone } from "./SrZone";
import type { DemoStats } from "./act2/Hero";
import { Egg } from "./act2/Egg";
import { BuildingPhase } from "./phases/BuildingPhase";
import { JoinPhase } from "./phases/JoinPhase";
import { NetworkPhase } from "./phases/NetworkPhase";
import { useDemoBuild } from "./useDemoBuild";
import { usePhaseChange } from "./usePhaseChange";

type ExperienceProps = { opener: ReactNode; live: Live; stats: DemoStats; themeClassName: string };

// One phase on screen at a time. The opener is Aaron's page; the switch covers it
// and lands on the join phase; the rest follow the demo state or a button.
export function SpeedrunExperience({ opener, live, stats, themeClassName }: ExperienceProps) {
  const [phaseState, dispatchPhase] = useReducer(phaseReducer, INITIAL_PHASE);
  const [state, dispatch] = useReducer(demoReducer, live, initialDemoState);
  const [held, setHeld] = useState(false);
  const [arrivalKey, setArrivalKey] = useState(0);
  // The skip button asked for the board outright, so its build log never waits for a press.
  const [skipped, setSkipped] = useState(false);
  const { phase, tab } = phaseState;
  const { go, announcement } = usePhaseChange(phase, dispatchPhase);
  const { lines, failed, retry, readUpload } = useDemoBuild(state, dispatch);

  // The phase follows the demo: a pick or an upload starts the build, a failed upload returns to the join.
  const previousStep = useRef(state.step);
  useEffect(() => {
    const event = phaseEventFor(previousStep.current, state.step);
    previousStep.current = state.step;
    if (event) go(event);
  }, [state.step, go]);

  // "Skip to the dashboard" has to land on one: Sam with the inbox already connected.
  const skip = () => {
    setSkipped(true);
    dispatch({ type: "pickPerson", key: "sam" });
    dispatch({ type: "connectInbox", on: true });
  };
  const resetDemo = () => {
    setSkipped(false);
    dispatch({ type: "reset" });
  };
  const startOver = () => {
    go({ type: "startOver" }, { onLeft: resetDemo });
  };
  const replayTop = () => {
    go({ type: "replayTop" }, { onLeft: resetDemo });
  };

  return (
    <>
      <SrZone active={phase !== "opener"} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {phase === "opener" ? (
        <section data-act="1" className="px-6 pt-32 md:px-12">
          {opener}
        </section>
      ) : (
        <section id="act-2" tabIndex={-1} data-speedrun="" data-phase={phase} className={`min-h-screen [overflow-y:clip] focus:outline-none ${themeClassName}`}>
          <div data-demo="" data-step={state.step}>
            {phase === "join" && <JoinPhase state={state} dispatch={dispatch} stats={stats} onUpload={readUpload} onSkip={skip} held={held} arrivalKey={arrivalKey} />}
            {phase === "building" && <BuildingPhase skipped={skipped} state={state} lines={lines} failed={failed} onRetry={retry} onDone={() => go({ type: "logDone" })} />}
            {phase === "network" && <NetworkPhase state={state} dispatch={dispatch} tab={tab} onTab={(next) => go({ type: "tab", tab: next })} onStartOver={startOver} onReplayTop={replayTop} />}
            <Egg />
          </div>
          <PinnedAffiliation />
        </section>
      )}
      <Switch
        showTurn={phase === "opener"}
        onCovered={() => {
          setHeld(true);
          go({ type: "enterJoin" }, { instant: true });
        }}
        onRevealStart={() => {
          setHeld(false);
          setArrivalKey((key) => key + 1);
        }}
      />
    </>
  );
}
