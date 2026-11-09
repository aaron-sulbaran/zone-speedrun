"use client";

import { useEffect, useLayoutEffect, useRef, type Dispatch } from "react";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { motion, prefersReducedMotion, SR_EASE } from "@/lib/speedrun/motion";
import { Hero, SkipButton, type DemoStats } from "../act2/Hero";
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
  const mountKey = useRef(arrivalKey);
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
    if (arrivalKey === mountKey.current || targets.length === 0) return;
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
    <div ref={frameRef} data-phase-frame="" className="mx-auto max-w-[1200px] px-6 pb-20 pt-10 md:pt-16 lg:grid lg:grid-cols-[1fr_minmax(0,480px)] lg:items-start lg:gap-12">
      <Hero stats={stats} onSkip={onSkip} />
      <div>
        <JoinCard state={state} dispatch={dispatch} onUpload={onUpload} />
        <div className="mt-5 flex justify-center lg:hidden">
          <SkipButton onSkip={onSkip} />
        </div>
      </div>
    </div>
  );
}
