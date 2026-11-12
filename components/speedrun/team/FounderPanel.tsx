"use client";

import { useEffect, useId, useRef } from "react";
import { speedrunCopy } from "@/lib/content";
import type { DeskAction } from "@/lib/speedrun/desk";
import { candidateName, capitalizeFirst, deskFit } from "@/lib/speedrun/deskNarration";
import type { IntroRequest } from "@/lib/speedrun/introRequest";
import { FILLED, SECONDARY } from "../act2/IntroControls";
import { useModalDialog } from "../act2/useModalDialog";
import { ActingAs } from "./ActingAs";
import { NARRATION_LOOK, PANEL_PROMPT } from "./Narration";

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
  const title = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const name = candidateName(request);
  const [project, ...rest] = request.candidate.shipped;
  const { whyThem, whyRole } = deskFit(request);
  const why = [whyThem, whyRole].filter((text) => text.trim());
  const close = () => step({ type: "closePanel" });
  // Close hands focus back to the visitor's card, unless the answer opened a drawer that already took it.
  const dialog = useModalDialog(close, () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("[data-desk-panel]")) return active;
    return document.querySelector<HTMLElement>("[data-desk-card][data-mine] button");
  });
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  return (
    <dialog
      ref={dialog}
      data-founder-panel=""
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto max-h-[92dvh] w-[min(calc(100vw-2rem),36rem)] max-w-none overflow-y-auto overscroll-contain rounded-3xl border border-sr-soft bg-sr-surface p-5 text-sr-ink shadow-[0_16px_56px_var(--sr-soft)] backdrop:bg-[color-mix(in_srgb,var(--sr-ink)_40%,transparent)] sm:p-6"
    >
      <p data-panel-narration="" aria-hidden="true" className={`mb-3 ${NARRATION_LOOK} ${PANEL_PROMPT}`}>
        {line}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <ActingAs who="founder" nowrap />
        <button type="button" data-founder-close="" onClick={close} className={`${SECONDARY} ml-auto shrink-0`}>
          {copy.closePanel}
        </button>
      </div>
      <h2 id={id} ref={title} tabIndex={-1} className="mt-3 text-lg font-medium leading-snug focus:outline-none">
        {copy.founder.heading(request.match.company.name)}
      </h2>
      <article data-one-pager="" className="mt-4 space-y-4 rounded-2xl border border-sr-soft p-4">
        <header>
          <p className="break-words text-xl font-semibold">{capitalizeFirst(name)}</p>
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
