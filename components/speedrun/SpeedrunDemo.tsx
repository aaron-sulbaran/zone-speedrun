"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { composeBuildLog } from "@/lib/speedrun/buildLog";
import { demoReducer, initialDemoState, MAX_PLACES, type Live } from "@/lib/speedrun/demoState";
import { prefersReducedMotion } from "@/lib/speedrun/motion";
import { postResume } from "@/lib/speedrun/readClient";
import type { MatchResult } from "@/lib/speedrun/match";
import type { Intake, Profile } from "@/lib/speedrun/types";
import { BuildLog } from "./act2/BuildLog";
import { BriefPreview } from "./act2/BriefPreview";
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
  const [skippedLog, setSkippedLog] = useState(false);
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

  // An upload skips the sample fetch: the read route answers with the profile and the ranked matches.
  const readUpload = async (file: File) => {
    dispatch({ type: "uploaded" });
    const outcome = await postResume(file, state.answers);
    if (outcome.ok) {
      dispatch({ type: "built", profile: outcome.profile, result: outcome.result });
      return;
    }
    dispatch({ type: "uploadFailed", error: outcome.error });
  };

  const retry = () => {
    setAttempt((n) => n + 1);
  };

  return (
    <div data-demo="" data-step={step}>
      <Hero stats={stats} showCtas={step === "join"} onSkip={() => dispatch({ type: "pickPerson", key: "sam" })} />
      <div className="px-6 pb-24">
        {step === "join" && <JoinCard state={state} dispatch={dispatch} onUpload={readUpload} />}
        {step === "building" && <BuildPlaceholder step="building" failed={failed} onRetry={retry} />}
        {/* Reduced motion keeps the finished log above the matches, so the answers stay readable. */}
        {step === "ready" && result && (!logDone || prefersReducedMotion()) && (
          <div className={logDone ? "mb-16" : undefined}>
            <BuildLog
              lines={lines}
              onDone={(skipped) => {
                setSkippedLog(skipped);
                setLoggedFor(result);
              }}
            />
          </div>
        )}
        {step === "ready" && result && logDone && (
          <div className="space-y-16">
            <Matches result={result} focusHeading={skippedLog} />
            <Board state={state} dispatch={dispatch} />
            <BriefPreview state={state} />
          </div>
        )}
      </div>
    </div>
  );
}
