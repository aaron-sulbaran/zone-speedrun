"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { speedrunCopy } from "@/lib/content";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import { SECONDARY } from "../act2/IntroControls";
import { NARRATION_LOOK, PANEL_PROMPT } from "./Narration";

const copy = speedrunCopy.team;

type Props = { mode: "compare" | "intro" | "sample"; line: string; heading: string; about?: string; onClose: () => void; children: ReactNode };

// A drawer at the board's right edge (the whole width on a phone). From md a scrim dims the desk behind it, and a
// click on the scrim closes it like Close; focus goes to the heading when it opens, and Escape closes it. It scrolls inside itself.
export function DeskPanel({ mode, line, heading, about, onClose, children }: Props) {
  const root = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    const node = root.current;
    if (!node || prefersReducedMotion()) return;
    const { stepMs, stepPx } = motion();
    const enter = node.animate([{ opacity: 0, transform: `translateX(${stepPx}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: stepMs, easing: STEP_EASE });
    const fade = scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: stepMs, easing: STEP_EASE });
    return () => {
      enter.cancel();
      fade?.cancel();
    };
  }, [mode]);

  // A modal dialog (the founder's page) handles its own Escape, so an Escape it already took is left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("dialog[open]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div ref={scrim} data-desk-scrim="" aria-hidden="true" onClick={onClose} className="absolute inset-0 z-10 hidden bg-[color-mix(in_srgb,var(--sr-ink)_25%,transparent)] md:block" />
      <aside
        ref={root}
        data-desk-panel={mode}
        aria-labelledby={id}
        className="absolute inset-y-0 right-0 z-20 flex w-full flex-col overflow-y-auto overscroll-contain border-sr-soft bg-sr-surface px-4 pb-6 pt-4 md:w-[420px] md:border-l md:shadow-[0_0_40px_color-mix(in_srgb,var(--sr-ink)_18%,transparent)]"
      >
        <p data-panel-narration="" aria-hidden="true" className={`mb-4 ${NARRATION_LOOK} ${PANEL_PROMPT}`}>
          {line}
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={id} ref={title} tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink focus:outline-none">
              {heading}
            </h3>
            {about && (
              <p data-compare-about="" className="mt-1 break-words text-sm text-sr-ink2">
                {about}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={copy.closePanel} className={`${SECONDARY} shrink-0 px-0`}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </aside>
    </>
  );
}
