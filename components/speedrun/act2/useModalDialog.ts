"use client";

import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion, SR_EASE, SR_STEP_MS } from "@/lib/speedrun/motion";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Browsers let Tab leave a modal for their own chrome; this wraps it from the last control to the first and back. */
function keepTabInside(dialog: HTMLDialogElement, event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const controls = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  const at = document.activeElement;
  // The heading takes focus on open and is not a tab stop, so a Shift+Tab from it wraps like one from the first control.
  if (event.shiftKey && (at === first || at === dialog || (at instanceof HTMLElement && !controls.includes(at)))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && at === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The one place a native modal dialog opens and closes (ActionSheet today, PR 7's sheets next).
 * Mount the dialog to open it and unmount it to close it. showModal puts it in the top layer (so no Portal),
 * traps focus, focuses the heading named by aria-labelledby, closes on Escape and makes the page inert; this adds the body scroll lock, the opening motion
 * (none under reduced motion) and the hand-back of focus to whatever opened it.
 */
export function useModalDialog(onClose: () => void, returnFocus?: () => HTMLElement | null) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const returnRef = useRef(returnFocus);
  useLayoutEffect(() => {
    closeRef.current = onClose;
    returnRef.current = returnFocus;
  });

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    // A reader hears what the dialog is before reaching a control, and Enter cannot open a link by accident.
    const heading = document.getElementById(dialog.getAttribute("aria-labelledby") ?? "");
    if (heading && dialog.contains(heading)) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    const entrance = prefersReducedMotion()
      ? null
      : dialog.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: SR_STEP_MS, easing: SR_EASE },
        );
    // Escape and the close button both end in a close event, so the parent hears every way out.
    const onNativeClose = () => closeRef.current();
    const onKeyDown = (event: KeyboardEvent) => keepTabInside(dialog, event);
    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("keydown", onKeyDown);
      entrance?.cancel();
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
      // The explicit target wins: some engines do not focus a button on click, so what was focused on open can be the page.
      // It is read on the next frame, once the page has re-rendered (a confirmed line has swapped its button).
      requestAnimationFrame(() => {
        const target = returnRef.current?.() ?? opener;
        if (target?.isConnected) target.focus();
      });
    };
  }, []);

  return ref;
}
