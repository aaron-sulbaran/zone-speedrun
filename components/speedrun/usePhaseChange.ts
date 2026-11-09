"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { speedrunCopy } from "@/lib/content";
import { motion, prefersReducedMotion } from "@/lib/speedrun/motion";
import type { Phase, PhaseEvent } from "@/lib/speedrun/phase";

// Moves between phases. `go` fades the current frame up and out, then dispatches;
// the switch passes `instant` because its cover already hides the page. After a
// phase changes the page returns to the top, focus lands on the new phase's
// heading, and a polite line names the phase. Never driven by wheel or swipe.
export function usePhaseChange(phase: Phase, dispatchPhase: Dispatch<PhaseEvent>) {
  const [announcement, setAnnouncement] = useState("");
  const leavingRef = useRef(false);
  const shownRef = useRef<Phase>(phase);

  const go = useCallback(
    (event: PhaseEvent, options?: { instant?: boolean }) => {
      if (leavingRef.current) return;
      const frame = document.querySelector<HTMLElement>("[data-phase-frame]");
      if (options?.instant || prefersReducedMotion() || !frame) {
        dispatchPhase(event);
        return;
      }
      leavingRef.current = true;
      const exit = frame.animate(
        [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: `translateY(-${motion().stepPx}px)` }],
        { duration: motion().phaseExitMs, easing: "ease", fill: "forwards" },
      );
      const finish = () => {
        leavingRef.current = false;
        dispatchPhase(event);
        // An event the reducer ignores leaves this frame in place; let it show again.
        window.setTimeout(() => exit.cancel(), 80);
      };
      exit.finished.then(finish, finish);
    },
    [dispatchPhase],
  );

  useEffect(() => {
    if (shownRef.current === phase) return;
    shownRef.current = phase;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>("[data-phase-heading]")?.focus({ preventScroll: true });
    setAnnouncement(speedrunCopy.phases.announce[phase]);
  }, [phase]);

  return { go, announcement };
}
