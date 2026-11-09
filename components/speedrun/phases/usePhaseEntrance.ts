"use client";

import { useLayoutEffect, type RefObject } from "react";
import { CARD_EASE, motion, prefersReducedMotion } from "@/lib/speedrun/motion";

// The card entrance every phase plays on mount: a short rise and fade.
export function usePhaseEntrance(frameRef: RefObject<HTMLElement | null>, skip = false) {
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (skip || !frame || prefersReducedMotion()) return;
    const { cardInMs, cardInPx } = motion();
    const entrance = frame.animate(
      [{ opacity: 0, transform: `translateY(${cardInPx}px)` }, { opacity: 1, transform: "translateY(0)" }],
      { duration: cardInMs, easing: CARD_EASE, fill: "backwards" },
    );
    return () => entrance.cancel();
    // Only the first paint decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
