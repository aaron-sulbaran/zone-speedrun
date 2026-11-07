"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { composeBuildLog } from "@/lib/speedrun/buildLog";
import { demoReducer, initialDemoState, MAX_PLACES, type Live } from "@/lib/speedrun/demoState";
import type { MatchResult } from "@/lib/speedrun/match";
import type { Intake, Profile } from "@/lib/speedrun/types";
import { BuildLog } from "./act2/BuildLog";
import { BuildPlaceholder } from "./act2/BuildPlaceholder";
import { Hero, type DemoStats } from "./act2/Hero";
import { Board } from "./act2/Board";
import { JoinCard } from "./act2/JoinCard";
import { Matches } from "./act2/Matches";

async function fetchMatches(intake: Intake, personKey: string, signal: AbortSignal) {
  const response = await fetch("/speedrun/api/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intake: { ...intake, places: intake.places.slice(0, MAX_PLACES) }, personKey }),
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as { profile: Profile; result: MatchResult };
}

export function SpeedrunDemo({ live, stats }: { live: Live; stats: DemoStats }) {
  const [state, dispatch] = useReducer(demoReducer, live, initialDemoState);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loggedFor, setLoggedFor] = useState<MatchResult | null>(null);
  const { step, personKey, intake, profile, result } = state;
  // A failure belongs to one build (person and attempt), so a new build starts clean.
  const buildKey = `${personKey}:${attempt}`;
  const failed = failedKey === buildKey;
  const lines = useMemo(() => (profile && result ? composeBuildLog(intake, profile, result) : []), [intake, profile, result]);
  const logDone = result !== null && loggedFor === result;

  useEffect(() => {
    if (step !== "building" || !personKey) return;
    const controller = new AbortController();
    fetchMatches(intake, personKey, controller.signal)
      .then(({ profile, result }) => dispatch({ type: "built", profile, result }))
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(buildKey);
      });
    return () => controller.abort();
    // The intake is fixed once the build starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, personKey, attempt]);

  const retry = () => {
    setAttempt((n) => n + 1);
  };

  return (
    <div data-demo="" data-step={step}>
      <Hero stats={stats} showCtas={step === "join"} onSkip={() => dispatch({ type: "pickPerson", key: "sam" })} />
      <div className="px-6 pb-24">
        {step === "join" && <JoinCard state={state} dispatch={dispatch} />}
        {step === "building" && <BuildPlaceholder step="building" failed={failed} onRetry={retry} />}
        {step === "ready" && result && !logDone && <BuildLog lines={lines} onDone={() => setLoggedFor(result)} />}
        {step === "ready" && result && logDone && (
          <div className="space-y-16">
            <Matches result={result} />
            <Board state={state} dispatch={dispatch} />
            {/* Slots for the morning brief and the decisions. */}
            <div data-slot="brief" />
            <div data-slot="decisions" />
          </div>
        )}
      </div>
    </div>
  );
}
