"use client";

import { useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { speedrunCopy } from "@/lib/content";
import { COVER_EASE, motion, SR_EASE } from "@/lib/speedrun/motion";
import { shiftReducer } from "@/lib/speedrun/shift";
import { getMotionOverrides, subscribeMotion } from "@/lib/speedrun/tuning";

// The sweep. It plays when the hero's button bumps `playSignal`, never on scroll. It covers the page from the right, calls onCovered while the
// page is hidden (the parent changes phase there), holds, then reveals to the
// left. The strip sits at z 39, under the site's logo and Menu pill (z 40), and
// stays mounted across the phase change.

const REDUCE = "(prefers-reduced-motion: reduce)";
// The band trails the cover: the accent fades through the speedrun hues to cream, then to nothing.
const BAND_BG = "linear-gradient(90deg, var(--color-accent) 0%, var(--sr-purple) 22%, var(--sr-aqua) 58%, var(--sr-cream) 84%, transparent 100%)";

type SwitchProps = { onCovered: () => void; onRevealStart: () => void; playSignal?: number };

export function Switch({ onCovered, onRevealStart, playSignal }: SwitchProps) {
  const copy = speedrunCopy.shift;
  // A lab override of the band width re-renders the strip too.
  useSyncExternalStore(subscribeMotion, getMotionOverrides, getMotionOverrides);
  const { bandVw: stripBandVw } = motion();
  const [phase, send] = useReducer(shiftReducer, "idle");
  const stripRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const runRef = useRef(0);
  const animationsRef = useRef<Animation[]>([]);
  const callbacks = useRef({ onCovered, onRevealStart });
  useEffect(() => {
    callbacks.current = { onCovered, onRevealStart };
  });
  const busy = phase !== "idle";

  useEffect(
    () => () => {
      runRef.current += 1;
      animationsRef.current.forEach((a) => a.cancel());
    },
    [],
  );

  function track(animation: Animation) {
    animationsRef.current.push(animation);
    return animation;
  }

  function playReduced(run: number) {
    const main = document.getElementById("main");
    if (!main) return send("abort");
    const { fadeOutMs, fadeInMs } = motion();
    send("covered");
    send("covered");
    track(main.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeOutMs, fill: "forwards" })).finished.then(() => {
      if (run !== runRef.current) return;
      callbacks.current.onCovered();
      const back = track(main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeInMs }));
      main.getAnimations().forEach((a) => a !== back && a.cancel());
      callbacks.current.onRevealStart();
      back.finished.then(() => run === runRef.current && send("revealed"), () => {});
    }, () => {});
  }

  function play() {
    if (busy) return;
    const strip = stripRef.current;
    const line = lineRef.current;
    if (!strip || !line) return;
    const run = (runRef.current += 1);
    send("go");
    if (window.matchMedia(REDUCE).matches) return playReduced(run);
    const { coverMs, holdMs, revealMs, bandVw } = motion();
    strip.style.visibility = "visible";
    const cover = track(strip.animate([{ transform: "translateX(100vw)" }, { transform: "translateX(0)" }], { duration: coverMs, easing: COVER_EASE, fill: "forwards" }));
    track(line.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 1 }, { opacity: 0 }], { duration: 760, delay: 300, fill: "forwards" }));
    cover.finished.then(() => {
      if (run !== runRef.current) return;
      send("covered");
      callbacks.current.onCovered();
      window.setTimeout(() => {
        if (run !== runRef.current) return;
        send("covered");
        callbacks.current.onRevealStart();
        const reveal = track(strip.animate([{ transform: "translateX(0)" }, { transform: `translateX(-${100 + bandVw}vw)` }], { duration: revealMs, easing: SR_EASE, fill: "forwards" }));
        reveal.finished.then(() => {
          if (run !== runRef.current) return;
          strip.style.visibility = "hidden";
          strip.getAnimations().concat(line.getAnimations()).forEach((a) => a.cancel());
          animationsRef.current = [];
          send("revealed");
        }, () => {});
      }, holdMs);
    }, () => {});
  }

  // The tuning panel's replay: a changed signal plays exactly as the button does.
  const lastSignal = useRef(playSignal);
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });
  useEffect(() => {
    if (playSignal === lastSignal.current) return;
    lastSignal.current = playSignal;
    playRef.current();
  }, [playSignal]);

  return (
    <>
      <div
        ref={stripRef}
        data-shift-strip=""
        data-speedrun=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-[39] flex"
        style={{ width: `${100 + stripBandVw}vw`, visibility: "hidden", transform: "translateX(100vw)" }}
      >
        <div className="relative h-full w-screen bg-accent">
          <p ref={lineRef} className="absolute left-0 top-1/2 w-screen -translate-y-1/2 px-6 text-center font-display text-[clamp(28px,4vw,52px)] text-background" style={{ opacity: 0 }}>
            {copy.line}
          </p>
        </div>
        <div className="h-full" style={{ width: `${stripBandVw}vw`, background: BAND_BG }} />
      </div>
    </>
  );
}
