"use client";

import { useEffect, useRef, useState } from "react";
import { speedrunCopy } from "@/lib/content";
import { BAR_FILL_MS, timingFor, type BuildLine } from "@/lib/speedrun/buildLog";
import { prefersReducedMotion } from "@/lib/speedrun/motion";

const FADE_MS = 160;

const shown = (line: BuildLine, elapsed: number) => {
  const { typeMs } = line;
  const progress = typeMs <= 0 ? 1 : Math.min(1, Math.max(0, (elapsed - line.at) / typeMs));
  return line.text.slice(0, Math.ceil(line.text.length * progress));
};

export function BuildLog({ lines, onDone }: { lines: BuildLine[]; onDone: (skipped: boolean) => void }) {
  const copy = speedrunCopy.build;
  const timing = timingFor(lines);
  const [elapsed, setElapsed] = useState(() => (prefersReducedMotion() ? timing.end : 0));
  const skippedRef = useRef(false);
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
    // The clock starts once and runs until the beat ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, timing.end]);

  useEffect(() => {
    if (finished) doneRef.current(skippedRef.current);
  }, [finished]);

  const terminal = lines.map((line, i) => ({ line, i })).filter(({ line }) => line.tone !== "made");
  const made = lines.find((line) => line.tone === "made");
  const barWidth = Math.min(1, Math.max(0, (elapsed - timing.barStart) / BAR_FILL_MS));
  const typingIndex = lines.findIndex((line) => elapsed < line.at + line.typeMs);

  return (
    <section data-build-log="" aria-label={finished ? copy.labelDone : copy.label} className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between px-1 pb-3">
        <h3 className="font-srcond text-xs uppercase tracking-widest text-sr-ink2">{finished ? copy.labelDone : copy.label}</h3>
        {!finished && (
          <button
            type="button"
            onClick={() => {
              skippedRef.current = true;
              setElapsed(timing.end);
            }}
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
              {shown(line, elapsed)}
              {typingIndex === i && <Cursor />}
            </p>
          );
        })}
        {typingIndex === -1 && !finished && <Cursor />}
      </div>
      {made && elapsed >= made.at && (
        <div className="mt-6" data-made-for="">
          <p aria-hidden="true" className="text-xl font-semibold leading-snug md:text-2xl">
            {shown(made, elapsed)}
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
