"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import { INLINE_LINK } from "./links";
import type { IntroSlot } from "@/lib/speedrun/introSlot";

const copy = speedrunCopy.matches.intro;
// 44 px floors the tap target on phones without changing the type size (Ruling 68).
const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-4 font-srcond text-xs uppercase tracking-wider transition-[background-color,transform] duration-200 ease-sr focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100";
export const SECONDARY = `${BASE} border-sr-soft text-sr-ink hover:bg-sr-bg`;
/** The pane's one filled action (Ruling 41). */
export const FILLED = `${BASE} border-sr-ink bg-sr-ink text-sr-surface hover:opacity-90`;

type ToggleProps = { rank: number | null; onChange: (on: boolean) => void };

/** The name stays "Bring forward"; aria-pressed carries the state and the rank is the text beside it. */
export function BringForwardToggle({ rank, onChange, filled }: ToggleProps & { filled: boolean }) {
  const on = rank !== null;
  return (
    <>
      <button type="button" data-bring-forward="" aria-pressed={on} onClick={() => onChange(!on)} className={filled && !on ? FILLED : SECONDARY}>
        <Bookmark aria-hidden="true" size={14} className={on ? "fill-current" : ""} />
        {copy.bring}
      </button>
      {on && (
        <span data-shortlist-rank="" className="font-srcond text-xs uppercase tracking-wider text-sr-ink2">
          {copy.rank(rank)}
        </span>
      )}
    </>
  );
}

type RowToggleProps = ToggleProps & { company: string };

/** The list row's own toggle: a sibling of the row button, never inside it. */
export function RowBringForward({ company, rank, onChange }: RowToggleProps) {
  const on = rank !== null;
  return (
    <button
      type="button"
      data-row-bring-forward=""
      aria-pressed={on}
      aria-label={copy.bringRow(company)}
      onClick={() => onChange(!on)}
      className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full text-sr-ink2 transition-colors duration-200 hover:bg-sr-bg hover:text-sr-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple aria-pressed:text-sr-ink motion-reduce:transition-none"
    >
      <Bookmark aria-hidden="true" size={16} className={on ? "fill-current" : ""} />
    </button>
  );
}

type SlotProps = { slot: IntroSlot; onRequest: () => void; onSwap: () => void };

/** The request or swap button, when this slot has one. The filled look is the request when it can be made. */
export function IntroButton({ slot, onRequest, onSwap }: SlotProps) {
  if (slot.kind === "request") {
    return (
      <button type="button" data-request-intro="" disabled={!slot.enabled} onClick={onRequest} aria-describedby={slot.hint ? "sr-intro-note" : undefined} className={`${slot.enabled ? FILLED : SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}>
        {copy.request}
      </button>
    );
  }
  if (slot.kind === "elsewhere" && slot.canSwap) {
    return (
      <button type="button" data-swap-intro="" onClick={onSwap} className={SECONDARY}>
        {copy.swap}
      </button>
    );
  }
  return null;
}

/** The line under the buttons: why the request is off, where it sits, or that this match holds it. */
export function IntroNote({ slot, onBoard }: { slot: IntroSlot; onBoard: () => void }) {
  const hereRef = useRef<HTMLParagraphElement>(null);
  const isHere = slot.kind === "here";
  const wasHere = useRef(isHere);
  // The button the visitor pressed is gone; the line that replaced it takes focus, but not on first show.
  useEffect(() => {
    if (isHere && !wasHere.current) hereRef.current?.focus({ preventScroll: true });
    wasHere.current = isHere;
  }, [isHere]);
  if (slot.kind === "here") {
    return (
      <p ref={hereRef} tabIndex={-1} data-intro-here="" className="mt-3 text-sm text-sr-ink focus:outline-none">
        {copy.here}
      </p>
    );
  }
  if (slot.kind === "elsewhere") {
    return (
      <p data-intro-on="" className="mt-3 text-sm text-sr-ink2">
        {copy.on(slot.company)}
      </p>
    );
  }
  if (slot.kind === "noPath") {
    return (
      <p id="sr-intro-note" className="mt-3 text-sm text-sr-ink2">
        {copy.hintNoPath}
      </p>
    );
  }
  const { hint } = slot;
  if (!hint) return null;
  if (hint.reason === "leadNoPath") {
    const lead = copy.hintNoPathFirst;
    return (
      <p id="sr-intro-note" className="mt-3 text-sm text-sr-ink2">
        {lead.before}
        <button type="button" data-intro-board="" onClick={onBoard} className={INLINE_LINK}>{lead.link}</button>
        {lead.after}
      </p>
    );
  }
  const text = hint.reason === "bring" ? copy.hintBring : copy.hintFirst(hint.rank);
  return (
    <p id="sr-intro-note" className="mt-3 text-sm text-sr-ink2">
      {text}
    </p>
  );
}
