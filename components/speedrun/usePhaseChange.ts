"use client";

import { useCallback, useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { motion, prefersReducedMotion } from "@/lib/speedrun/motion";
import type { Phase, PhaseEvent } from "@/lib/speedrun/phase";

type Change = { event: PhaseEvent; onLeft?: () => void };
type GoOptions = { instant?: boolean; onLeft?: () => void };

// Moves between phases. `go` fades the current frame up and out, then dispatches;
// events that arrive during the exit wait their turn and run in order. The switch
// passes `instant` because its cover already hides the page. `onLeft` runs in the
// same batch as the phase change, so a reset lands after the frame has exited.
// After a phase changes the page returns to the top, focus lands on the new
// phase's heading, and a polite line names the phase. Never driven by wheel or swipe.
export function usePhaseChange(phase: Phase, dispatchPhase: Dispatch<PhaseEvent>) {
  const [announcement, setAnnouncement] = useState("");
  const queueRef = useRef<Change[] | null>(null);
  const shownRef = useRef<Phase>(phase);

  const apply = useCallback(
    ({ event, onLeft }: Change) => {
      dispatchPhase(event);
      onLeft?.();
    },
    [dispatchPhase],
  );

  const go = useCallback(
    (event: PhaseEvent, options?: GoOptions) => {
      const change: Change = { event, onLeft: options?.onLeft };
      if (queueRef.current) {
        queueRef.current.push(change);
        return;
      }
      const frame = document.querySelector<HTMLElement>("[data-phase-frame]");
      if (options?.instant || prefersReducedMotion() || !frame) {
        apply(change);
        return;
      }
      queueRef.current = [change];
      const { phaseExitMs, phaseExitPx } = motion();
      const exit = frame.animate(
        [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: `translateY(-${phaseExitPx}px)` }],
        { duration: phaseExitMs, easing: "ease", fill: "forwards" },
      );
      const finish = () => {
        const queued = queueRef.current ?? [];
        queueRef.current = null;
        queued.forEach(apply);
        // An event the reducer ignores leaves this frame in place; let it show again.
        window.setTimeout(() => exit.cancel(), 80);
      };
      exit.finished.then(finish, finish);
    },
    [apply],
  );

  useLayoutEffect(() => {
    if (shownRef.current === phase) return;
    shownRef.current = phase;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>("[data-phase-heading]")?.focus({ preventScroll: true });
    setAnnouncement(speedrunCopy.phases.announce[phase]);
  }, [phase]);

  return { go, announcement };
}
