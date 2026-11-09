"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { composeBuildLog } from "@/lib/speedrun/buildLog";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import type { MatchResult } from "@/lib/speedrun/match";
import { toIntake } from "@/lib/speedrun/onboarding";
import { PEOPLE } from "@/lib/speedrun/people";
import { postResume } from "@/lib/speedrun/readClient";
import { matchRequestBody } from "@/lib/speedrun/requests";
import type { Intake, PersonKey, Profile } from "@/lib/speedrun/types";
import { visitorName } from "./visitorName";

async function fetchMatches(intake: Intake, personKey: PersonKey, signal: AbortSignal) {
  const response = await fetch("/speedrun/api/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: matchRequestBody(intake, personKey),
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as { profile: Profile; result: MatchResult };
}

// Everything that talks to the network for the demo: the sample match fetch, the
// resume upload, the retry, and the build log lines. The phase follows the demo
// state, so this hook never touches the phase.
export function useDemoBuild(state: DemoState, dispatch: Dispatch<DemoAction>) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { step, personKey, intake, profile, result, buildId, answers } = state;
  // Ids only ever go up, so an upload can never reuse the id of an earlier build.
  const idRef = useRef(buildId);
  useEffect(() => {
    idRef.current = Math.max(idRef.current, buildId);
  }, [buildId]);
  // A failure belongs to one build (id and attempt), so a new build starts clean.
  const failed = failedKey === `${buildId}:${attempt}`;
  const sampleOwner = personKey ? PEOPLE[personKey].profile.firstName : null;
  const lines = useMemo(
    () =>
      profile && result
        ? composeBuildLog(intake, profile, result, {
            name: visitorName({ answers, personKey, profile }),
            sampleOwner,
          })
        : [],
    [intake, profile, result, answers, personKey, sampleOwner],
  );

  useEffect(() => {
    if (step !== "building" || !personKey) return;
    const controller = new AbortController();
    const key = `${buildId}:${attempt}`;
    fetchMatches(intake, personKey, controller.signal)
      .then(({ profile, result }) => dispatch({ type: "built", buildId, profile, result }))
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(key);
      });
    return () => controller.abort();
    // The intake is fixed once the build starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, personKey, buildId, attempt]);

  // An upload skips the sample fetch: the read route answers with the profile and the ranked matches.
  const readUpload = useCallback(
    async (file: File) => {
      const uploadId = ++idRef.current;
      dispatch({ type: "uploaded", buildId: uploadId });
      const outcome = await postResume(file, toIntake(answers));
      if (outcome.ok) {
        dispatch({ type: "built", buildId: uploadId, profile: outcome.profile, result: outcome.result });
        return;
      }
      dispatch({ type: "uploadFailed", buildId: uploadId, error: outcome.error });
    },
    [answers, dispatch],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { lines, failed, retry, readUpload };
}
