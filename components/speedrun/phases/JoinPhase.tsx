"use client";

import { useEffect, useLayoutEffect, useRef, type Dispatch } from "react";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { motion, prefersReducedMotion, SR_EASE } from "@/lib/speedrun/motion";
import { Hero, type DemoStats } from "../act2/Hero";
import { JoinCard } from "../act2/JoinCard";
import { usePhaseEntrance } from "./usePhaseEntrance";

type JoinPhaseProps = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  stats: DemoStats;
  onUpload: (file: File) => void;
  onSkip: () => void;
  /** True while the switch's cover is on screen: mount hidden and wait for the reveal. */
  held: boolean;
  /** Bumps when the switch starts revealing; the cascade plays then. */
  arrivalKey: number;
};

// The hero's children, then the card last, rise in one after another.
export function JoinPhase({ state, dispatch, stats, onUpload, onSkip, held, arrivalKey }: JoinPhaseProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLElement[]>([]);
  const startedWithoutCover = useRef(!held);
  usePhaseEntrance(frameRef, held);

  const cascadeTargets = () => {
    const frame = frameRef.current;
    if (!frame) return [];
    return [...frame.querySelectorAll<HTMLElement>("[data-cascade], #join")];
  };

  useLayoutEffect(() => {
    if (startedWithoutCover.current || prefersReducedMotion()) return;
    hiddenRef.current = cascadeTargets();
    hiddenRef.current.forEach((el) => {
      el.style.opacity = "0";
    });
  }, []);

  useEffect(() => {
    const targets = hiddenRef.current;
    if (arrivalKey === 0 || targets.length === 0) return;
    hiddenRef.current = [];
    const { cascadeMs, cascadeStaggerMs } = motion();
    const running = targets.map((el, i) => {
      const animation = el.animate(
        [{ opacity: 0, transform: "translateY(10px) scale(.99)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: cascadeMs, delay: i * cascadeStaggerMs, easing: SR_EASE, fill: "backwards" },
      );
      el.style.opacity = "";
      return animation;
    });
    return () => running.forEach((animation) => animation.cancel());
  }, [arrivalKey]);

  return (
    <div ref={frameRef} data-phase-frame="">
      <Hero stats={stats} showCtas onSkip={onSkip} />
      <div className="px-6 pb-24">
        <JoinCard state={state} dispatch={dispatch} onUpload={onUpload} />
      </div>
    </div>
  );
}
