"use client";

import { useEffect, useId, useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DeskAction } from "@/lib/speedrun/desk";
import { candidateName } from "@/lib/speedrun/deskNarration";
import type { IntroRequest } from "@/lib/speedrun/introRequest";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import { FILLED, SECONDARY } from "../act2/IntroControls";
import { ActingAs } from "./ActingAs";
import { NARRATION_LOOK } from "./Narration";

const copy = speedrunCopy.team;
const CHIP = "inline-flex min-h-11 items-center rounded-full border border-dashed border-sr-soft px-3 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">{label}</h3>
      {children}
    </section>
  );
}

// The visitor plays the founder (Ruling 76): the one-pager Splits built, and the one question. A native modal dialog
// gives the focus trap, Escape, the inert desk behind it and the dim; the page stops scrolling while it is open.
export function FounderPanel({ request, line, step }: { request: IntroRequest; line: string; step: (action: DeskAction) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const name = candidateName(request);
  const [project, ...rest] = request.candidate.shipped;
  const why = [request.fit.whyThem, ...request.match.reasons.map((reason) => reason.text)].filter((text, i, all) => text.trim() && all.indexOf(text) === i);
  const close = () => step({ type: "closePanel" });
  // The browser lets Tab past the last control into its own chrome; the panel keeps focus by wrapping at both ends.
  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const controls = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
    const [first, last] = [controls[0], controls[controls.length - 1]];
    if (!first || !last) return;
    const at = document.activeElement;
    if (event.shiftKey && (at === first || at === title.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && at === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    title.current?.focus({ preventScroll: true });
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const enter = prefersReducedMotion()
      ? null
      : node.animate([{ opacity: 0, transform: `translateY(${motion().stepPx}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration: motion().stepMs, easing: STEP_EASE });
    return () => {
      enter?.cancel();
      document.body.style.overflow = before;
      if (node.open) node.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      data-founder-panel=""
      aria-labelledby={id}
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto max-h-[92dvh] w-[min(94vw,36rem)] overflow-y-auto overscroll-contain rounded-3xl border border-sr-soft bg-sr-surface p-5 text-sr-ink shadow-[0_16px_56px_var(--sr-soft)] backdrop:bg-[color-mix(in_srgb,var(--sr-ink)_40%,transparent)] sm:p-6"
    >
      <p data-panel-narration="" aria-hidden="true" className={`mb-3 ${NARRATION_LOOK}`}>
        {line}
      </p>
      <ActingAs who="founder" />
      <h2 id={id} ref={title} tabIndex={-1} className="mt-3 text-lg font-medium leading-snug focus:outline-none">
        {copy.founder.heading(request.match.company.name)}
      </h2>
      <article data-one-pager="" className="mt-4 space-y-4 rounded-2xl border border-sr-soft p-4">
        <header>
          <p className="break-words text-xl font-semibold">{name}</p>
          {request.candidate.headline && <p className="break-words text-sm text-sr-ink2">{request.candidate.headline}</p>}
        </header>
        {project && (
          <Section label={copy.compare.project}>
            <p className="break-words text-sm leading-relaxed">{project}</p>
          </Section>
        )}
        {rest.length > 0 && (
          <Section label={copy.founder.work}>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {rest.map((item) => (
                <li key={item} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section label={copy.founder.links}>
          <div className="flex flex-wrap items-center gap-2">
            {[copy.founder.linkedin, copy.founder.x, copy.founder.portfolio].map((label) => (
              <span key={label} className={CHIP}>
                {label}
              </span>
            ))}
          </div>
          <p className="text-xs text-sr-ink2">{copy.founder.linksNote}</p>
        </Section>
        <Section label={copy.founder.why}>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {why.map((text) => (
              <li key={text} className="break-words">
                {text}
              </li>
            ))}
          </ul>
        </Section>
      </article>
      <p className="mt-5 font-medium">{copy.founder.ask(name)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => step({ type: "founder", yes: true })} className={FILLED}>
          {copy.founder.yes}
        </button>
        <button type="button" onClick={() => step({ type: "founder", yes: false })} className={SECONDARY}>
          {copy.founder.notNow}
        </button>
      </div>
    </dialog>
  );
}
