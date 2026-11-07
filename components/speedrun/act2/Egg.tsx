"use client";

import { useEffect, useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import { isTypingTarget, pushClick, pushKey } from "@/lib/speedrun/egg";
import { prefersReducedMotion, SR_EASE, SR_STEP_MS } from "@/lib/speedrun/motion";

// The one speedrun logo on Act 2 sits in the join card.
const LOGO = "#join img[src$='speedrun-logo.svg']";

// A framed placeholder, closed and unreachable until "sux" is typed or the logo is clicked five times.
// Aaron picks the meme later; no image ships here.
export function Egg() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let buffer = "";
    let clicks: number[] = [];
    const reveal = () => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      if (!prefersReducedMotion()) {
        dialog.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: SR_STEP_MS, easing: SR_EASE },
        );
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target as HTMLElement | null)) {
        buffer = "";
        return;
      }
      const step = pushKey(buffer, event.key);
      buffer = step.buffer;
      if (step.matched) reveal();
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(LOGO)) return;
      const step = pushClick(clicks, Date.now());
      clicks = step.times;
      if (step.matched) reveal();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const copy = speedrunCopy.egg;
  return (
    // showModal gives the focus trap, Escape and the inert page; the close event hands focus back.
    <dialog
      ref={dialogRef}
      aria-label={copy.label}
      data-egg=""
      onClose={() => returnFocusRef.current?.focus()}
      className="m-auto w-[min(92vw,22rem)] rounded-3xl border border-sr-soft bg-sr-surface p-8 text-center text-sr-ink shadow-[0_16px_56px_var(--sr-soft)] backdrop:bg-sr-ink/40"
    >
      <p className="font-srcond text-2xl uppercase leading-tight tracking-wide">
        {copy.line1}
        <br />
        {copy.line2}
      </p>
      <form method="dialog" className="mt-6">
        <button
          type="submit"
          className="rounded-full bg-sr-ink px-5 py-2.5 font-srcond text-sm uppercase tracking-wider text-sr-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple"
        >
          {copy.close}
        </button>
      </form>
    </dialog>
  );
}
