"use client";

import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent } from "react";
import { Affiliation } from "@/components/speedrun/Affiliation";
import { SpeedrunLogo } from "@/components/speedrun/SpeedrunLogo";
import { speedrunCopy } from "@/lib/content";
import { MAX_PLACES, type DemoAction, type DemoState } from "@/lib/speedrun/demoState";
import { prefersReducedMotion, SR_EASE, SR_STEP_MS } from "@/lib/speedrun/motion";
import { FNS, type PersonKey } from "@/lib/speedrun/types";
import { Chip } from "./Chip";
import { PeoplePicker } from "./PeoplePicker";

const STEP_KEYS = ["targets", "places", "why", "resume"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const FROSTED_INPUT = "w-full rounded-2xl bg-sr-hud px-4 py-3 text-base font-semibold text-sr-ink backdrop-blur placeholder:text-sr-sec focus:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

function toggled<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function JoinCard({ state, dispatch, onUpload }: { state: DemoState; dispatch: Dispatch<DemoAction>; onUpload?: (file: File) => void }) {
  const copy = speedrunCopy.join;
  const { joinStep } = state;
  const intake = state.answers;
  const stepKey = STEP_KEYS[joinStep];
  const [selected, setSelected] = useState<PersonKey | null>(null);
  const [typedPlace, setTypedPlace] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const whyRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previous = useRef(joinStep);

  useEffect(() => {
    const from = previous.current;
    previous.current = joinStep;
    if (from === joinStep) return;
    // Focus follows the step: the why input is its first control, otherwise the question.
    (joinStep === 2 ? whyRef.current : headingRef.current)?.focus({ preventScroll: true });
    if (prefersReducedMotion()) return;
    const rise = joinStep > from ? 16 : -16;
    bodyRef.current?.animate(
      [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: "translateY(0)" }],
      { duration: SR_STEP_MS, easing: SR_EASE },
    );
  }, [joinStep]);

  const last = joinStep === 3;
  const proceed = () => {
    if (!last) dispatch({ type: "next" });
    else if (selected) dispatch({ type: "pickPerson", key: selected });
  };
  const addTypedPlace = () => {
    const place = typedPlace.trim();
    if (place && !intake.places.includes(place) && intake.places.length < MAX_PLACES) dispatch({ type: "answer", patch: { places: [...intake.places, place] } });
    setTypedPlace("");
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
    if (target.closest("button") && !target.hasAttribute("data-chip")) return;
    event.preventDefault();
    if (target === document.getElementById("join-place") && typedPlace.trim()) addTypedPlace();
    else proceed();
  };

  const placeChips = [...copy.placeChips, ...intake.places.filter((p) => !copy.placeChips.includes(p))];
  const placesFull = intake.places.length >= MAX_PLACES;
  const question = copy.steps[stepKey].question;
  const resumeHelper = state.live.reading ? copy.steps.resume.helperLive : copy.steps.resume.helper;

  return (
    <form
      id="join"
      tabIndex={-1}
      aria-label={copy.label}
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      className="mx-auto w-full max-w-2xl scroll-mt-24 rounded-3xl bg-sr-surface shadow-[0_16px_56px_var(--sr-soft)] focus:outline-none"
    >
      <div className="flex items-center gap-2 px-6 pt-5 sm:gap-3 md:px-8">
        <SpeedrunLogo className="h-4 w-auto" />
        <span className="whitespace-nowrap font-srcond text-[11px] uppercase tracking-wider text-sr-ink2 sm:text-xs sm:tracking-widest">{copy.label}</span>
        <span aria-hidden="true" className="ml-auto whitespace-nowrap font-srcond text-[11px] tabular-nums tracking-wider text-sr-ink2 sm:text-xs sm:tracking-widest">
          {pad(joinStep + 1)} / 04
        </span>
        <p className="sr-only" aria-live="polite">
          {`${copy.stepWord} ${joinStep + 1} ${copy.stepOf} 4. ${question}`}
        </p>
      </div>
      <div className="mx-6 mt-4 h-1 overflow-hidden rounded-full bg-sr-soft md:mx-8" role="presentation">
        <div
          data-progress=""
          className="h-full rounded-full transition-[width] duration-[260ms] ease-sr motion-reduce:transition-none"
          style={{ width: `${((joinStep + 1) / 4) * 100}%`, backgroundImage: "var(--sr-grad-accent)" }}
        />
      </div>
      <div ref={bodyRef} className="px-6 pb-6 pt-6 md:px-8">
        <p aria-hidden="true" className="font-srcond text-sm uppercase tracking-widest text-sr-purple">{pad(joinStep + 1)} &rarr;</p>
        <h3 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold leading-tight focus:outline-none md:text-3xl">{question}</h3>
        {stepKey === "resume" && <p className="mt-1 text-sm text-sr-ink2">{resumeHelper}</p>}
        {(stepKey === "targets" || stepKey === "places") && <p className="mt-1 text-sm text-sr-ink2">{placesFull && stepKey === "places" ? copy.placesFull : copy.steps[stepKey].helper}</p>}
        <div className="mt-5">
          {stepKey === "targets" && (
            <div className="flex flex-wrap gap-2">
              {FNS.map((fn) => (
                <Chip key={fn} pressed={intake.targets.includes(fn)} onToggle={() => dispatch({ type: "answer", patch: { targets: toggled(intake.targets, fn) } })}>
                  {copy.targetLabels[fn]}
                </Chip>
              ))}
            </div>
          )}
          {stepKey === "places" && (
            <>
              <div className="flex flex-wrap gap-2">
                {placeChips.map((place) => (
                  <Chip key={place} pressed={intake.places.includes(place)} disabled={placesFull && !intake.places.includes(place)} onToggle={() => dispatch({ type: "answer", patch: { places: toggled(intake.places, place) } })}>
                    {place}
                  </Chip>
                ))}
              </div>
              <input id="join-place" disabled={placesFull} aria-label={copy.steps.places.inputLabel} placeholder={copy.steps.places.inputPlaceholder} value={typedPlace} maxLength={60} onChange={(e) => setTypedPlace(e.target.value)} className={`${FROSTED_INPUT} mt-3`} />
            </>
          )}
          {stepKey === "why" && (
            <input ref={whyRef} aria-label={copy.steps.why.inputLabel} placeholder={copy.steps.why.placeholder} value={intake.why} maxLength={300} onChange={(e) => dispatch({ type: "answer", patch: { why: e.target.value } })} className={FROSTED_INPUT} />
          )}
          {stepKey === "resume" && (
            <PeoplePicker
              selected={selected}
              onSelect={setSelected}
              connected={{ inbox: state.inboxConnected, calendar: state.calendarConnected }}
              onConnect={(which, on) => dispatch({ type: which === "inbox" ? "connectInbox" : "connectCalendar", on })}
              liveReading={state.live.reading}
              onUpload={onUpload}
            />
          )}
        </div>
      </div>
      <div data-join-footer="" className="sticky bottom-0 z-10 rounded-b-3xl border-t border-sr-soft bg-sr-foot px-6 py-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => dispatch({ type: "back" })} disabled={joinStep === 0} className="rounded-full px-4 py-2 font-srcond text-sm uppercase tracking-wider text-sr-ink2 transition-opacity duration-200 hover:text-sr-ink disabled:invisible">
            {copy.back}
          </button>
          <button
            type="button"
            onClick={proceed}
            disabled={last && !selected}
            className="ml-auto rounded-2xl bg-sr-hud px-7 py-3 font-srcond text-base uppercase tracking-wider text-sr-ink shadow-[0_0_28px_var(--sr-purple)] backdrop-blur transition-[transform,background-color] duration-200 ease-sr hover:-translate-y-px hover:bg-sr-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple active:scale-[.97] disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
          >
            {last ? copy.finish : copy.next}
          </button>
          <span className="hidden font-srcond text-xs uppercase tracking-widest text-sr-ink2 sm:inline">{copy.pressEnter} &crarr;</span>
        </div>
        <p className="mt-3 text-xs text-sr-ink2">{copy.nothingSent}</p>
        <Affiliation variant="inline" />
      </div>
    </form>
  );
}
