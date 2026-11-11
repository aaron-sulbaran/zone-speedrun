"use client";

import { useState, type Dispatch, type KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import { MAX_PLACES, type DemoAction, type DemoState } from "@/lib/speedrun/demoState";
import { NAME_MAX, type Answers, type StepKey } from "@/lib/speedrun/onboarding";
import { FNS, type PersonKey } from "@/lib/speedrun/types";
import { ArrangementCards } from "./ArrangementCards";
import { ChoicePills } from "./ChoicePills";
import { Chip } from "./Chip";
import { PeoplePicker } from "./PeoplePicker";

const FROSTED_INPUT = "w-full rounded-2xl bg-sr-hud px-4 py-3 text-base font-semibold text-sr-ink backdrop-blur placeholder:text-sr-sec focus:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

function toggled<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

type JoinStepProps = {
  stepKey: StepKey;
  index: number;
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  selected: PersonKey | null;
  onSelect: (key: PersonKey) => void;
  onPick: () => void;
  /** A tap on a choice pill: records the answer, then the card advances a beat later. */
  onChoose: (patch: Partial<Answers>) => void;
  onUpload?: (file: File) => void;
};

export const pad = (n: number) => String(n).padStart(2, "0");

// One question and its control. The card keys it by step, so each step starts fresh.
export function JoinStep({ stepKey, index, state, dispatch, selected, onSelect, onPick, onChoose, onUpload }: JoinStepProps) {
  const copy = speedrunCopy.join;
  const [typedPlace, setTypedPlace] = useState("");
  const answers = state.answers;
  const set = (patch: Partial<Answers>) => dispatch({ type: "answer", patch });
  const config = copy.steps[stepKey];
  const helper = stepKey === "resume" ? (state.live.reading ? copy.steps.resume.helperLive : copy.steps.resume.helper) : "helper" in config ? config.helper : "";
  const placesFull = answers.places.length >= MAX_PLACES;

  const addTypedPlace = () => {
    const place = typedPlace.trim();
    if (place && !answers.places.includes(place) && answers.places.length < MAX_PLACES) set({ places: [...answers.places, place] });
    setTypedPlace("");
  };
  // Enter with typed text adds the place; on an empty input it falls through and advances.
  const onPlaceKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || !typedPlace.trim()) return;
    event.preventDefault();
    event.stopPropagation();
    // The input disables itself at the cap, which would drop focus to the body.
    if (answers.places.length + 1 >= MAX_PLACES) {
      const card = event.currentTarget.closest<HTMLElement>("form");
      (card?.querySelector<HTMLElement>('[data-chip][aria-pressed="true"]') ?? card?.querySelector<HTMLElement>("[data-chip]:not(:disabled)") ?? card)?.focus({ preventScroll: true });
    }
    addTypedPlace();
  };

  const placeChips = [...copy.placeChips, ...answers.places.filter((p) => !copy.placeChips.includes(p))];
  // Focus lands on the first picked place, else the first one; never a disabled chip.
  const placeFocus = placeChips.find((p) => answers.places.includes(p)) ?? placeChips[0];

  return (
    <>
      <p aria-hidden="true" className="font-srcond text-sm uppercase tracking-widest text-sr-purple">{pad(index + 1)} &rarr;</p>
      <h3 className="mt-2 text-2xl font-semibold leading-tight md:text-3xl">{config.question}</h3>
      {helper && <p className="mt-1 text-sm text-sr-ink2">{stepKey === "places" && placesFull ? copy.placesFull : helper}</p>}
      <div className="mt-5">
        {stepKey === "name" && (
          <input data-phase-focus="" autoComplete="given-name" aria-label={copy.steps.name.inputLabel} placeholder={copy.steps.name.placeholder} value={answers.name} maxLength={NAME_MAX} onChange={(e) => set({ name: e.target.value })} className={FROSTED_INPUT} />
        )}
        {stepKey === "targets" && (
          <div className="flex flex-wrap gap-2">
            {FNS.map((fn, i) => (
              <Chip key={fn} focusFirst={i === 0} pressed={answers.targets.includes(fn)} onToggle={() => set({ targets: toggled(answers.targets, fn) })}>
                {copy.targetLabels[fn]}
              </Chip>
            ))}
          </div>
        )}
        {stepKey === "student" && <ChoicePills label={copy.steps.student.question} value={answers.student} onChoose={(student) => onChoose({ student })} />}
        {stepKey === "arrangements" && <ArrangementCards value={answers.arrangements} onToggle={(item) => set({ arrangements: toggled(answers.arrangements, item) })} />}
        {stepKey === "places" && (
          <>
            <div className="flex flex-wrap gap-2">
              {placeChips.map((place) => (
                <Chip key={place} focusFirst={place === placeFocus} pressed={answers.places.includes(place)} disabled={placesFull && !answers.places.includes(place)} onToggle={() => set({ places: toggled(answers.places, place) })}>
                  {place}
                </Chip>
              ))}
            </div>
            <input disabled={placesFull} aria-label={copy.steps.places.inputLabel} placeholder={copy.steps.places.inputPlaceholder} value={typedPlace} maxLength={60} onChange={(e) => setTypedPlace(e.target.value)} onKeyDown={onPlaceKey} className={`${FROSTED_INPUT} mt-3`} />
          </>
        )}
        {stepKey === "founding" && <ChoicePills label={copy.steps.founding.question} value={answers.founding} onChoose={(founding) => onChoose({ founding })} />}
        {stepKey === "why" && (
          <input data-phase-focus="" aria-label={copy.steps.why.inputLabel} placeholder={copy.steps.why.placeholder} value={answers.why} maxLength={300} onChange={(e) => set({ why: e.target.value })} className={FROSTED_INPUT} />
        )}
        {stepKey === "resume" && (
          <PeoplePicker
            selected={selected}
            onSelect={onSelect}
            onPick={onPick}
            connected={{ inbox: state.inboxConnected, calendar: state.calendarConnected }}
            onConnect={(which, on) => dispatch({ type: which === "inbox" ? "connectInbox" : "connectCalendar", on })}
            liveReading={state.live.reading}
            onUpload={onUpload}
            uploadError={state.uploadError}
          />
        )}
      </div>
    </>
  );
}
