"use client";

import { User } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.network.account;
const ITEM = "flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left font-srcond text-sm uppercase tracking-wider text-sr-ink transition-colors duration-200 hover:bg-sr-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none";

type AccountMenuProps = { name: string | null; onStartOver: () => void; onReplayTop: () => void };

/** The first code point, upper-cased, so an emoji or an accented letter is never cut in half. */
export const initialOf = (name: string) => (Array.from(name.trim())[0] ?? "").toUpperCase();

// Focus landing outside the menu. An ancestor of the menu does not count: WebKit sends a clicked button's focus to its nearest focusable ancestor.
const leftMenu = (root: HTMLElement | null, next: EventTarget | null) => next instanceof Node && !root?.contains(next) && !next.contains(root);

// A round button with the visitor's initial. The panel holds the full name and the two resets; it closes on
// Escape (focus returns to the button), on a press outside, and before any action runs.
export function AccountMenu({ name, onStartOver, onReplayTop }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const initial = name ? initialOf(name) : "";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    // Safari does not focus the button on click, so the root never held focus for a blur to leave; watch where focus lands.
    const onFocusIn = (event: FocusEvent) => {
      // WebKit sends a clicked button's focus to its nearest focusable ancestor; that is not leaving the menu.
      if (leftMenu(rootRef.current, event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (open && leftMenu(rootRef.current, next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={copy.label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-sr-ink font-srcond text-sm uppercase text-sr-surface transition-transform duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {initial || <User aria-hidden="true" size={18} />}
      </button>
      <div
        id={panelId}
        hidden={!open}
        data-account-panel=""
        className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-sr-soft bg-sr-surface p-2 shadow-lg"
      >
        {name && <p className="break-words px-3 py-2 font-semibold text-sr-ink">{name}</p>}
        <button type="button" onClick={run(onStartOver)} className={ITEM}>
          {copy.startOver}
        </button>
        <button type="button" onClick={run(onReplayTop)} className={ITEM}>
          {copy.replayTop}
        </button>
        <p className="border-t border-sr-soft px-3 pb-2 pt-3 font-srcond text-xs uppercase tracking-widest text-sr-ink2">{speedrunCopy.affiliation}</p>
      </div>
    </div>
  );
}
