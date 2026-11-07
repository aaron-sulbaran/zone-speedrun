"use client";

import { useEffect, useRef, useState } from "react";
import { speedrunCopy } from "@/lib/content";
import type { BuildLine } from "@/lib/speedrun/buildLog";
import { prefersReducedMotion } from "@/lib/speedrun/motion";

const CHARS_PER_SECOND = 30;
const MADE_CHARS_PER_SECOND = 45;
const FADE_MS = 160;
const BAR_DELAY_MS = 150;
const BAR_FILL_MS = 700;
const HOLD_MS = 600;
const SLOT_PAD_MS = 80;

type Timing = { typeMs: number[]; barStart: number; barEnd: number; end: number };

function timingFor(lines: BuildLine[]): Timing {
  const typeMs = lines.map((line, i) => {
    const natural = (line.text.length / (line.tone === "made" ? MADE_CHARS_PER_SECOND : CHARS_PER_SECOND)) * 1000;
    const next = lines[i + 1];
    return next ? Math.min(natural, Math.max(120, next.at - line.at - SLOT_PAD_MS)) : natural;
  });
  const last = lines.length - 1;
  const barStart = last < 0 ? 0 : lines[last].at + typeMs[last] + BAR_DELAY_MS;
  const barEnd = barStart + BAR_FILL_MS;
  return { typeMs, barStart, barEnd, end: barEnd + HOLD_MS };
}

const shown = (line: BuildLine, typeMs: number, elapsed: number) => {
  const progress = typeMs <= 0 ? 1 : Math.min(1, Math.max(0, (elapsed - line.at) / typeMs));
  return line.text.slice(0, Math.ceil(line.text.length * progress));
};

export function BuildLog({ lines, onDone }: { lines: BuildLine[]; onDone: () => void }) {
  const copy = speedrunCopy.build;
  const timing = timingFor(lines);
  const [elapsed, setElapsed] = useState(() => (prefersReducedMotion() ? timing.end : 0));
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const finished = elapsed >= timing.end;

  useEffect(() => {
    if (finished) return;
    const start = performance.now() - elapsed;
    let frame = requestAnimationFrame(function tick(now) {
      setElapsed(Math.min(timing.end, now - start));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // The clock restarts only if the lines change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, timing.end]);

  useEffect(() => {
    if (finished) doneRef.current();
  }, [finished]);

  const terminal = lines.map((line, i) => ({ line, i })).filter(({ line }) => line.tone !== "made");
  const made = lines.find((line) => line.tone === "made");
  const madeIndex = lines.findIndex((line) => line.tone === "made");
  const barWidth = Math.min(1, Math.max(0, (elapsed - timing.barStart) / BAR_FILL_MS));
  const typingIndex = lines.findIndex((line, i) => elapsed < line.at + timing.typeMs[i]);

  return (
    <section data-build-log="" aria-label={copy.label} className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between px-1 pb-3">
        <h3 className="font-srcond text-xs uppercase tracking-widest text-sr-ink2">{copy.label}</h3>
        {!finished && (
          <button
            type="button"
            onClick={() => setElapsed(timing.end)}
            className="rounded-full px-3 py-1 font-srcond text-xs uppercase tracking-widest text-sr-ink2 transition-colors duration-200 hover:text-sr-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple"
          >
            {copy.skip}
          </button>
        )}
      </div>
      <ul className="sr-only">
        {lines.map((line) => (
          <li key={line.at}>{line.text}</li>
        ))}
      </ul>
      <div aria-hidden="true" data-build-visible="" className="min-h-[15rem] rounded-xl bg-sr-term px-5 py-5 font-mono text-[13px] leading-relaxed text-sr-surface sm:text-sm">
        {terminal.map(({ line, i }) => {
          if (elapsed < line.at) return null;
          const opacity = Math.min(1, (elapsed - line.at) / FADE_MS);
          const lift = (1 - opacity) * 6;
          return (
            <p key={line.at} className="break-words" style={{ opacity, transform: `translateY(${lift}px)` }}>
              <span className="text-sr-aqua">&gt; </span>
              {shown(line, timing.typeMs[i], elapsed)}
              {typingIndex === i && <Cursor />}
            </p>
          );
        })}
        {typingIndex === -1 && !finished && <Cursor />}
      </div>
      {made && elapsed >= made.at && (
        <div className="mt-6" data-made-for="">
          <p aria-hidden="true" className="text-xl font-semibold leading-snug md:text-2xl">
            {shown(made, timing.typeMs[madeIndex], elapsed)}
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-sr-soft" role="presentation">
            <div className="h-full rounded-full" style={{ width: `${barWidth * 100}%`, backgroundImage: "var(--sr-grad-accent)" }} />
          </div>
        </div>
      )}
    </section>
  );
}

function Cursor() {
  return <span className="ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] animate-pulse bg-sr-aqua motion-reduce:animate-none" />;
}
