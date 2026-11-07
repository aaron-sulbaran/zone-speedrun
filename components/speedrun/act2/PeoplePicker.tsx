"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import type { UploadErrorKey } from "@/lib/speedrun/demoState";
import { PERSON_KEYS, type PersonKey } from "@/lib/speedrun/types";

const FROSTED = "rounded-full bg-sr-hud px-4 py-2 text-sm font-semibold backdrop-blur transition-colors duration-200 ease-sr hover:bg-sr-strong disabled:opacity-40 motion-reduce:transition-none";

export type Connected = { inbox: boolean; calendar: boolean };

export function PeoplePicker({
  selected,
  onSelect,
  connected,
  onConnect,
  liveReading,
  onUpload,
  uploadError = null,
}: {
  selected: PersonKey | null;
  onSelect: (key: PersonKey) => void;
  connected: Connected;
  onConnect: (which: keyof Connected, on: boolean) => void;
  liveReading: boolean;
  onUpload?: (file: File) => void;
  uploadError?: UploadErrorKey | null;
}) {
  const copy = speedrunCopy.join;
  const group = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  // A failed upload sends the visitor back here; the message takes focus so it is read out.
  useEffect(() => {
    if (uploadError) alertRef.current?.focus();
  }, [uploadError]);

  const onArrows = (event: KeyboardEvent) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const at = selected ? PERSON_KEYS.indexOf(selected) : step > 0 ? -1 : 0;
    const next = PERSON_KEYS[(at + step + PERSON_KEYS.length) % PERSON_KEYS.length];
    onSelect(next);
    group.current?.querySelector<HTMLElement>(`[data-person="${next}"]`)?.focus();
  };

  return (
    <div>
      {liveReading && onUpload && (
        <div className="mb-4">
          <label className={`${FROSTED} inline-block cursor-pointer focus-within:ring-2 focus-within:ring-sr-purple`}>
            {copy.steps.resume.uploadLabel}
            <input
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload(file);
              }}
            />
          </label>
          <span className="ml-3 text-xs text-sr-ink2">{copy.steps.resume.uploadTypes}</span>
          <p className="mt-2 text-xs leading-snug text-sr-ink2">{copy.steps.resume.uploadNotice}</p>
          {uploadError && (
            <p ref={alertRef} tabIndex={-1} role="alert" className="mt-2 text-sm font-semibold text-sr-ink focus:outline-none">
              {copy.steps.resume.uploadErrors[uploadError]}
            </p>
          )}
        </div>
      )}
      <div ref={group} role="radiogroup" aria-label={copy.steps.resume.peopleLabel} onKeyDown={onArrows} className="grid gap-2 sm:grid-cols-2">
        {PERSON_KEYS.map((key, index) => {
          const person = speedrunCopy.people[key];
          const on = selected === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              data-person={key}
              tabIndex={on || (!selected && index === 0) ? 0 : -1}
              onClick={() => onSelect(key)}
              className={`rounded-2xl p-4 text-left transition-[background-color,box-shadow,transform] duration-200 ease-sr active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                on ? "bg-sr-surface shadow-[inset_0_0_0_2px_var(--sr-ink)]" : "bg-sr-hud hover:bg-sr-strong"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{person.name}</span>
                <span className="font-srcond text-xs uppercase tracking-widest text-sr-ink2">{person.mode}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug text-sr-ink2">{person.line}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!selected} onClick={() => onConnect("inbox", !connected.inbox)} className={FROSTED}>
          {connected.inbox ? copy.connect.connectedGmail : copy.connect.gmail}
        </button>
        <button type="button" disabled={!selected} onClick={() => onConnect("calendar", !connected.calendar)} className={FROSTED}>
          {connected.calendar ? copy.connect.connectedCalendar : copy.connect.calendar}
        </button>
      </div>
      <p className="mt-3 text-xs leading-snug text-sr-ink2">{copy.connect.connectNote}</p>
    </div>
  );
}
