"use client";

import dynamic from "next/dynamic";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { demoReducer, initialDemoState, type Live } from "@/lib/speedrun/demoState";
import { INITIAL_PHASE, phaseEventFor, phaseReducer } from "@/lib/speedrun/phase";
import { visitorName } from "./visitorName";
import { PinnedAffiliation } from "./PinnedAffiliation";
import { SplitsHero } from "./act1/SplitsHero";
import { Switch } from "./Shift";
import { SrZone } from "./SrZone";
import type { DemoStats } from "./act2/Hero";
import { EGG_ENABLED } from "@/lib/speedrun/egg";
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

type ExperienceProps = { live: Live; stats: DemoStats; themeClassName: string };

// One phase on screen at a time. The hero is Aaron's page; its button plays the switch, which covers it
// and lands on the join phase; the rest follow the demo state or a button.
export function SpeedrunExperience({ live, stats, themeClassName }: ExperienceProps) {
  const [phaseState, dispatchPhase] = useReducer(phaseReducer, INITIAL_PHASE);
  const [state, dispatch] = useReducer(demoReducer, live, initialDemoState);
  const [held, setHeld] = useState(false);
  const [arrivalKey, setArrivalKey] = useState(0);
  // The skip button asked for the board outright, so its build log never waits for a press.
  // It belongs to one build id: any reset (the card's own Start over included) bumps the id and clears it.
  const [skippedBuild, setSkippedBuild] = useState<number | null>(null);
  const skipped = skippedBuild === state.buildId;
  const tuning = useSyncExternalStore(noopSubscribe, wantsTuning, () => false);
  const [playSignal, setPlaySignal] = useState(0);
  const [heroRun, setHeroRun] = useState(0);
  const { phase, tab, side } = phaseState;
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
    setSkippedBuild(state.buildId + 1);
    dispatch({ type: "pickPerson", key: "sam" });
    dispatch({ type: "connectInbox", on: true });
  };
  const resetDemo = () => {
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

  // The panel's intro replay: the hero remounts, so its intro reads the tuned values again.
  const replayIntro = () => {
    if (phase === "opener") return setHeroRun((n) => n + 1);
    go({ type: "replayTop" }, { onLeft: () => {
      resetDemo();
      setHeroRun((n) => n + 1);
    } });
  };

  return (
    <>
      <SrZone active={phase !== "opener"} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {phase === "opener" ? (
        <SplitsHero key={heroRun} onStart={() => setPlaySignal((n) => n + 1)} />
      ) : (
        <section id="act-2" tabIndex={-1} data-speedrun="" data-phase={phase} data-side={phase === "network" ? side : undefined} className={`min-h-dvh [overflow-y:clip] focus:outline-none ${themeClassName}`}>
          <div data-demo="" data-step={state.step}>
            {phase === "join" && <JoinPhase state={state} dispatch={dispatch} stats={stats} onUpload={readUpload} onSkip={skip} held={held} arrivalKey={arrivalKey} />}
            {phase === "building" && <BuildingPhase name={visitorName(state)} skipped={skipped} state={state} lines={lines} failed={failed} onRetry={retry} onStartOver={startOver} onDone={() => go({ type: "logDone" })} />}
            {phase === "network" && <NetworkPhase state={state} dispatch={dispatch} tab={tab} side={side} onTab={(next) => dispatchPhase({ type: "tab", tab: next })} onSide={(next) => dispatchPhase({ type: "side", side: next })} onStartOver={startOver} onReplayTop={replayTop} />}
            {EGG_ENABLED && <Egg />}
          </div>
          {phase !== "network" && <PinnedAffiliation />}
        </section>
      )}
      <Switch
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
      {TuningPanel && tuning && <TuningPanel onReplay={replaySwitch} onReplayIntro={replayIntro} />}
    </>
  );
}
