"use client";

import { useCallback, useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { motion, prefersReducedMotion } from "@/lib/speedrun/motion";
import { createExitQueue, type ExitQueue } from "@/lib/speedrun/exitQueue";
import type { Phase, PhaseEvent, PhaseState } from "@/lib/speedrun/phase";
import { offerAgainst } from "@/lib/speedrun/phaseProjection";

type Change = { event: PhaseEvent; onLeft?: () => void };
type GoOptions = { instant?: boolean; onLeft?: () => void };

// Moves between phases. `go` fades the current frame up and out, then dispatches;
// events that arrive during the exit wait their turn and run in order. The switch
// passes `instant` because its cover already hides the page. `onLeft` runs in the
// same batch as the phase change, so a reset lands after the frame has exited.
// After a phase changes the page returns to the top, focus lands on the new
// phase's first control or heading, and a polite line names the phase. An event
// the phase will already have moved past (checked against the phase with the
// queued events applied) skips the exit but still runs `onLeft`, in order.
// Never driven by wheel or swipe.
export function usePhaseChange(phase: Phase, dispatchPhase: Dispatch<PhaseEvent>) {
  const [announcement, setAnnouncement] = useState("");
  const queueRef = useRef<ExitQueue<Change> | null>(null);
  const shownRef = useRef<Phase>(phase);
  // The phase once every queued event has run; the tab never matters to `go`.
  const projectedRef = useRef<PhaseState>({ phase, tab: "matches" });
  const queuedRef = useRef(0);

  const go = useCallback(
    (event: PhaseEvent, options?: GoOptions) => {
      queueRef.current ??= createExitQueue<Change>(({ event: next, onLeft }) => {
        queuedRef.current -= 1;
        dispatchPhase(next);
        onLeft?.();
      });
      const change: Change = { event, onLeft: options?.onLeft };
      const offer = offerAgainst(projectedRef.current, event);
      projectedRef.current = offer.next;
      queuedRef.current += 1;
      if (!offer.changes) {
        queueRef.current.offer(change, null);
        return;
      }
      const frame = document.querySelector<HTMLElement>("[data-phase-frame]");
      if (options?.instant || prefersReducedMotion() || !frame) {
        queueRef.current.offer(change, null);
        return;
      }
      queueRef.current.offer(change, () => {
        const { phaseExitMs, phaseExitPx } = motion();
        const exit = frame.animate(
          [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: `translateY(-${phaseExitPx}px)` }],
          { duration: phaseExitMs, easing: "ease", fill: "forwards" },
        );
        // An event the reducer ignores leaves this frame in place; let it show again after the change.
        return exit.finished.then(
          () => undefined,
          () => undefined,
        ).then(() => void window.setTimeout(() => exit.cancel(), 80));
      });
    },
    [dispatchPhase],
  );

  useLayoutEffect(() => {
    if (queuedRef.current === 0) projectedRef.current = { phase, tab: "matches" };
    if (shownRef.current === phase) return;
    shownRef.current = phase;
    window.scrollTo({ top: 0, behavior: "instant" });
    // A phase with a first control (the join card's) focuses that; the rest focus their heading.
    const target = document.querySelector<HTMLElement>("[data-phase-focus]") ?? document.querySelector<HTMLElement>("[data-phase-heading]");
    target?.focus({ preventScroll: true });
    setAnnouncement(speedrunCopy.phases.announce[phase]);
  }, [phase]);

  return { go, announcement };
}
