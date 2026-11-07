"use client";

import { useEffect, useReducer, useState } from "react";
import { demoReducer, initialDemoState, type Live } from "@/lib/speedrun/demoState";
import type { MatchResult } from "@/lib/speedrun/match";
import type { Profile } from "@/lib/speedrun/types";
import { BuildPlaceholder } from "./act2/BuildPlaceholder";
import { Hero, type DemoStats } from "./act2/Hero";
import { JoinCard } from "./act2/JoinCard";

async function fetchMatches(intake: unknown, personKey: string, signal: AbortSignal) {
  const response = await fetch("/speedrun/api/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intake, personKey }),
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as { profile: Profile; result: MatchResult };
}

export function SpeedrunDemo({ live, stats }: { live: Live; stats: DemoStats }) {
  const [state, dispatch] = useReducer(demoReducer, live, initialDemoState);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { step, personKey, intake } = state;

  useEffect(() => {
    if (step !== "building" || !personKey) return;
    const controller = new AbortController();
    fetchMatches(intake, personKey, controller.signal)
      .then(({ profile, result }) => dispatch({ type: "built", profile, result }))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
    // The intake is fixed once the build starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, personKey, attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  return (
    <div data-demo="" data-step={step}>
      <Hero stats={stats} onSkip={() => dispatch({ type: "pickPerson", key: "sam" })} />
      <div className="px-6 pb-24">
        {step === "join" ? <JoinCard state={state} dispatch={dispatch} /> : <BuildPlaceholder step={step} failed={failed} onRetry={retry} />}
      </div>
    </div>
  );
}
