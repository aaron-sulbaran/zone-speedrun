"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent } from "react";
import { Affiliation } from "@/components/speedrun/Affiliation";
import { SpeedrunLogo } from "@/components/speedrun/SpeedrunLogo";
import { speedrunCopy } from "@/lib/content";
import { displayName, isStepValid, stepsFor, type Answers } from "@/lib/speedrun/onboarding";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { createSubmitBeat } from "@/lib/speedrun/submitBeat";
import { motion, prefersReducedMotion, STEP_EASE } from "@/lib/speedrun/motion";
import { SHORT_LANDSCAPE } from "@/lib/speedrun/viewport";
import type { PersonKey } from "@/lib/speedrun/types";
import { JoinStep, pad } from "./JoinStep";
import { useChoiceAdvance } from "./useChoiceAdvance";

const GHOST = "rounded-full px-4 py-2 font-srcond text-sm uppercase tracking-wider text-sr-ink2 transition-opacity duration-200 hover:text-sr-ink disabled:opacity-30 disabled:hover:text-sr-ink2";

type JoinCardProps = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  onUpload?: (file: File) => void;
};

// One question per screen. The last step shows a short "building" beat, then
// picks the person; the experience moves the phase when the demo step changes.
export function JoinCard({ state, dispatch, onUpload }: JoinCardProps) {
  const copy = speedrunCopy.join;
  const { joinStep, answers } = state;
  const steps = stepsFor(answers);
  const total = steps.length;
  const stepKey = steps[joinStep];
  const last = joinStep === total - 1;
  const [selected, setSelected] = useState<PersonKey | null>(null);
  const [submitting, setSubmitting] = useState<"sample" | "upload" | null>(null);
  const cardRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const previous = useRef(joinStep);
  const beat = useMemo(() => createSubmitBeat(), []);
  const advance = useCallback(() => dispatch({ type: "next" }), [dispatch]);
  const choice = useChoiceAdvance(advance, motion().choiceAdvanceMs);

  const valid = isStepValid(stepKey, answers, { resumeChosen: selected !== null });
  const focusFirst = () => cardRef.current?.querySelector<HTMLElement>("[data-phase-focus]")?.focus({ preventScroll: true });

  // Step changes slide the body in (no exit) and move focus to the step's first control.
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = joinStep;
    if (from === joinStep) return;
    focusFirst();
    if (prefersReducedMotion()) return;
    const { stepMs, stepPx } = motion();
    bodyRef.current?.animate(
      [{ opacity: 0, transform: `translateY(${joinStep > from ? stepPx : -stepPx}px)` }, { opacity: 1, transform: "translateY(0)" }],
      { duration: stepMs, easing: STEP_EASE },
    );
  }, [joinStep]);

  useEffect(() => () => beat.cancel(), [beat]);
  // The skip button (or any build) moves the demo on while this card is still exiting.
  useEffect(() => {
    if (state.step !== "join") beat.cancel();
  }, [state.step, beat]);
  // A failed upload ends the beat so the error shows. The key includes buildId because
  // a fast failure can leave the same error value as before.
  const failure = state.uploadError ? `${state.uploadError}:${state.buildId}` : null;
  const [handledFailure, setHandledFailure] = useState<string | null>(null);
  if (failure && failure !== handledFailure) {
    setHandledFailure(failure);
    setSubmitting(null);
  }
  useEffect(() => {
    if (failure) beat.cancel();
  }, [failure, beat]);

  const clearSubmit = () => {
    beat.cancel();
    setSubmitting(null);
  };
  // The building beat; Start over, a phase change or unmount clears it before it fires.
  const beginSubmit = (kind: "sample" | "upload", action: () => void) => {
    setSubmitting(kind);
    beat.begin(action, motion().submittingMs);
  };
  const proceed = () => {
    if (!valid || submitting !== null) return;
    choice.cancel();
    if (!last) return dispatch({ type: "next" });
    if (!selected) return;
    beginSubmit("sample", () => dispatch({ type: "pickPerson", key: selected }));
  };
  // On phones (held either way) the footer sits at the end of the card, so a pick brings it, button included, into view.
  const revealFooter = () => {
    if (window.matchMedia("(min-width: 768px)").matches && !window.matchMedia(SHORT_LANDSCAPE).matches) return;
    // "instant", not "auto": the page's scroll-behavior is smooth, so "auto" would still animate.
    requestAnimationFrame(() => footerRef.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "instant" : "smooth" }));
  };
  const choose = (patch: Partial<Answers>) => {
    dispatch({ type: "answer", patch });
    choice.schedule();
  };
  const goBack = () => {
    choice.cancel();
    dispatch({ type: "back" });
  };
  const startOver = () => {
    choice.cancel();
    clearSubmit();
    setSelected(null);
    dispatch({ type: "reset" });
    requestAnimationFrame(focusFirst);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    const person = target.closest("[data-person]");
    if (person) {
      if (person.getAttribute("aria-checked") === "true") {
        event.preventDefault();
        proceed();
      }
      return;
    }
    // A button keeps its own Enter, except a chip or card, where Enter advances once the step is valid.
    if (target.closest("button") && !target.hasAttribute("data-chip")) return;
    event.preventDefault();
    proceed();
  };

  const person = selected ? speedrunCopy.people[selected].name.split(" ")[0] : null;
  const name = displayName(answers, submitting === "upload" ? null : person, speedrunCopy.phases.nameFallback);
  const question = copy.steps[stepKey].question;

  return (
    <form
      ref={cardRef}
      id="join"
      tabIndex={-1}
      aria-label={copy.label}
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      className="sr-join w-full scroll-mt-24 rounded-3xl bg-sr-surface shadow-[0_16px_56px_var(--sr-soft)] focus:outline-none"
    >
      <div className="flex items-center gap-2 px-6 pt-5 sm:gap-3 md:px-8">
        <SpeedrunLogo className="h-4 w-auto" />
        <span className="hidden whitespace-nowrap font-srcond text-xs uppercase tracking-widest text-sr-ink2 sm:inline">{copy.label}</span>
        <span aria-hidden="true" className="ml-auto whitespace-nowrap font-srcond text-[11px] tabular-nums tracking-wider text-sr-ink2 sm:text-xs sm:tracking-widest">
          {pad(joinStep + 1)} / {pad(total)}
        </span>
        <button type="button" onClick={startOver} className="-my-1 min-h-6 whitespace-nowrap px-1 py-1 font-srcond text-[11px] uppercase tracking-wider text-sr-ink2 underline-offset-4 hover:text-sr-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple sm:text-xs">
          {copy.startOver}
        </button>
        <p className="sr-only" aria-live="polite">{`${copy.stepWord} ${joinStep + 1} ${copy.stepOf} ${total}. ${question}`}</p>
      </div>
      <div className="mx-6 mt-4 h-2 overflow-hidden rounded-full bg-sr-soft md:mx-8" role="presentation">
        <div
          data-progress=""
          className="h-full rounded-full transition-[width] duration-[var(--sr-progress-ms)] ease-sr motion-reduce:transition-none"
          style={{ width: `${((joinStep + 1) / total) * 100}%`, backgroundImage: "var(--sr-grad-accent)", "--sr-progress-ms": `${motion().progressMs}ms` } as CSSProperties}
        />
      </div>
      <div ref={bodyRef} className="px-6 pb-6 pt-6 md:px-8">
        {submitting ? (
          <p role="status" className="py-10 text-2xl font-semibold leading-tight md:text-3xl">{speedrunCopy.build.heading(name)}</p>
        ) : (
          <JoinStep key={stepKey} stepKey={stepKey} index={joinStep} state={state} dispatch={dispatch} selected={selected} onSelect={setSelected} onPick={revealFooter} onChoose={choose} onUpload={onUpload && ((file) => beginSubmit("upload", () => onUpload(file)))} />
        )}
      </div>
      <div ref={footerRef} data-join-footer="" className="rounded-b-3xl border-t border-sr-soft px-6 py-4 md:sticky md:bottom-0 md:z-10 md:bg-sr-foot md:backdrop-blur md:px-8 short-landscape:static short-landscape:bg-transparent short-landscape:[backdrop-filter:none]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={goBack} disabled={joinStep === 0 || submitting !== null} className={GHOST}>
            {copy.back}
          </button>
          <button
            type="button"
            onClick={proceed}
            disabled={!valid || submitting !== null}
            className="ml-auto rounded-2xl bg-sr-hud px-7 py-3 font-srcond text-base uppercase tracking-wider text-sr-ink shadow-[0_0_28px_var(--sr-purple)] backdrop-blur transition-[transform,background-color] duration-200 ease-sr hover:-translate-y-px hover:bg-sr-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple active:scale-[.97] disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
          >
            {last ? copy.finish : copy.next}
          </button>
          <span className="hidden font-srcond text-xs uppercase tracking-widest text-sr-ink2 sm:inline">{copy.pressEnter} <span aria-hidden="true">&crarr;</span></span>
        </div>
        <p className="mt-3 text-xs text-sr-ink2">{copy.nothingSent}</p>
        <Affiliation variant="inline" />
      </div>
    </form>
  );
}
