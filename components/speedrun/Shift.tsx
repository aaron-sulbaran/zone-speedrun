"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { speedrunCopy } from "@/lib/content";
import { SHIFT_MS, shiftReducer } from "@/lib/speedrun/shift";

// The turn line, the button, and the sweep. The sweep plays on the button only,
// never on scroll. Both acts stay in the DOM; the sweep jumps scroll to the
// target under the cover. The strip sits at z 39, under the site's logo and
// Menu pill (z 40).

const COVER_EASE = "cubic-bezier(.7,0,.84,0)";
const REVEAL_EASE = "cubic-bezier(.16,1,.3,1)";
const REDUCE = "(prefers-reduced-motion: reduce)";
// The band trails the cover: the accent fades through the speedrun hues to cream, then to nothing.
const BAND_BG = "linear-gradient(90deg, var(--color-accent) 0%, var(--sr-purple) 22%, var(--sr-aqua) 58%, var(--sr-cream) 84%, transparent 100%)";

function jumpTo(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "instant", block: "start" });
  target.focus({ preventScroll: true });
}

export function Shift({ targetId }: { targetId: string }) {
  const copy = speedrunCopy.shift;
  const [phase, send] = useReducer(shiftReducer, "idle");
  const [played, setPlayed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const runRef = useRef(0);
  const animationsRef = useRef<Animation[]>([]);
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
    track(main.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SHIFT_MS.fadeOut, fill: "forwards" })).finished.then(() => {
      if (run !== runRef.current) return;
      setPlayed(true);
      jumpTo(targetId);
      const back = track(main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SHIFT_MS.fadeIn }));
      main.getAnimations().forEach((a) => a !== back && a.cancel());
      back.finished.then(() => run === runRef.current && send("revealed"), () => {});
    }, () => {});
    send("covered");
    send("covered");
  }

  function play() {
    if (busy) return;
    const strip = stripRef.current;
    const line = lineRef.current;
    if (!strip || !line) return;
    const run = (runRef.current += 1);
    send("go");
    if (window.matchMedia(REDUCE).matches) return playReduced(run);
    strip.style.visibility = "visible";
    const cover = track(strip.animate([{ transform: "translateX(100vw)" }, { transform: "translateX(0)" }], { duration: SHIFT_MS.cover, easing: COVER_EASE, fill: "forwards" }));
    track(line.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 1 }, { opacity: 0 }], { duration: 760, delay: 300, fill: "forwards" }));
    cover.finished.then(() => {
      if (run !== runRef.current) return;
      send("covered");
      setPlayed(true);
      jumpTo(targetId);
      window.setTimeout(() => {
        if (run !== runRef.current) return;
        send("covered");
        const reveal = track(strip.animate([{ transform: "translateX(0)" }, { transform: "translateX(-128vw)" }], { duration: SHIFT_MS.reveal, easing: REVEAL_EASE, fill: "forwards" }));
        reveal.finished.then(() => {
          if (run !== runRef.current) return;
          strip.style.visibility = "hidden";
          strip.getAnimations().concat(line.getAnimations()).forEach((a) => a.cancel());
          send("revealed");
        }, () => {});
      }, SHIFT_MS.hold);
    }, () => {});
  }

  function replay() {
    const strip = stripRef.current;
    const main = document.getElementById("main");
    runRef.current += 1;
    animationsRef.current.forEach((a) => a.cancel());
    animationsRef.current = [];
    if (strip) strip.style.visibility = "hidden";
    if (main) main.getAnimations().forEach((a) => a.cancel());
    send("abort");
    turnRef.current?.scrollIntoView({ behavior: "instant", block: "center" });
  }

  const buttonClass =
    "rounded-full px-6 py-4 font-label text-sm transition-transform duration-300 hover:-translate-y-0.5";
  return (
    <>
      <div ref={turnRef} className="mt-16 max-w-2xl">
        <p className="font-display text-3xl leading-tight text-foreground">{copy.turnLine1}</p>
        <p className="mt-1 font-display text-3xl leading-tight text-foreground">{copy.turnLine2}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={play} className={`${buttonClass} bg-accent text-background`}>
            {copy.button}
          </button>
          {played && (
            <button type="button" onClick={replay} className={`${buttonClass} border border-border text-foreground`}>
              {copy.replay}
            </button>
          )}
        </div>
      </div>
      <div
        ref={stripRef}
        data-shift-strip=""
        data-speedrun=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-[39] flex w-[128vw]"
        style={{ visibility: "hidden", transform: "translateX(100vw)" }}
      >
        <div className="relative h-full w-screen bg-accent">
          <p ref={lineRef} className="absolute left-0 top-1/2 w-screen -translate-y-1/2 px-6 text-center font-display text-[clamp(28px,4vw,52px)] text-background" style={{ opacity: 0 }}>
            {copy.line}
          </p>
        </div>
        <div className="h-full w-[28vw]" style={{ background: BAND_BG }} />
      </div>
    </>
  );
}
