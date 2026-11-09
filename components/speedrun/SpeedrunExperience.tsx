"use client";

import dynamic from "next/dynamic";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { demoReducer, initialDemoState, type Live } from "@/lib/speedrun/demoState";
import { INITIAL_PHASE, phaseEventFor, phaseReducer } from "@/lib/speedrun/phase";
import { visitorName } from "./visitorName";
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

// The dev-only motion panel: the import sits behind NODE_ENV, so a production build drops it.
const TuningPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./TuningPanel"), { ssr: false }) : null;

const noopSubscribe = () => () => {};
const wantsTuning = () => TuningPanel !== null && new URLSearchParams(window.location.search).has("tune");

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
  const tuning = useSyncExternalStore(noopSubscribe, wantsTuning, () => false);
  const [playSignal, setPlaySignal] = useState(0);
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

  // The panel's replay: back to the opener, then play the switch once it shows.
  const replaySwitch = () => {
    if (phase === "opener") return setPlaySignal((n) => n + 1);
    go(
      { type: "replayTop" },
      {
        onLeft: () => {
          resetDemo();
          setPlaySignal((n) => n + 1);
        },
      },
    );
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
            {phase === "building" && <BuildingPhase name={visitorName(state)} skipped={skipped} state={state} lines={lines} failed={failed} onRetry={retry} onDone={() => go({ type: "logDone" })} />}
            {phase === "network" && <NetworkPhase state={state} dispatch={dispatch} tab={tab} onTab={(next) => dispatchPhase({ type: "tab", tab: next })} onStartOver={startOver} onReplayTop={replayTop} />}
            <Egg />
          </div>
          <PinnedAffiliation />
        </section>
      )}
      <Switch
        showTurn={phase === "opener"}
        playSignal={playSignal}
        onCovered={() => {
          setHeld(true);
          go({ type: "enterJoin" }, { instant: true });
        }}
        onRevealStart={() => {
          setHeld(false);
          setArrivalKey((key) => key + 1);
        }}
      />
      {TuningPanel && tuning && <TuningPanel onReplay={replaySwitch} />}
    </>
  );
}
