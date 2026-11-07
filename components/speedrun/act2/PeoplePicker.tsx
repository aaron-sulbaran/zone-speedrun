"use client";

import { useState } from "react";
import { speedrunCopy } from "@/lib/content";
import type { PersonKey } from "@/lib/speedrun/types";

const KEYS: PersonKey[] = ["maya", "ravi", "sam", "lena", "dev"];
const FROSTED = "rounded-full bg-sr-hud px-4 py-2 text-sm font-semibold backdrop-blur transition-colors duration-200 ease-sr hover:bg-sr-strong disabled:opacity-40 motion-reduce:transition-none";

export function PeoplePicker({
  selected,
  onSelect,
  liveReading,
  onUpload,
}: {
  selected: PersonKey | null;
  onSelect: (key: PersonKey) => void;
  liveReading: boolean;
  onUpload?: (file: File) => void;
}) {
  const copy = speedrunCopy.join;
  const [connected, setConnected] = useState<{ gmail: boolean; calendar: boolean }>({ gmail: false, calendar: false });
  const toggle = (which: "gmail" | "calendar") => setConnected((now) => ({ ...now, [which]: !now[which] }));
  return (
    <div>
      {liveReading && onUpload && (
        <label className={`${FROSTED} mb-3 inline-block cursor-pointer`}>
          {copy.steps.resume.uploadLabel}
          <input type="file" accept=".pdf,.txt,.docx" className="sr-only" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}
      <ul aria-label={copy.steps.resume.peopleLabel} className="grid gap-2 sm:grid-cols-2">
        {KEYS.map((key) => {
          const person = speedrunCopy.people[key];
          const on = selected === key;
          return (
            <li key={key}>
              <button
                type="button"
                data-person={key}
                aria-pressed={on}
                onClick={() => onSelect(key)}
                className={`h-full w-full rounded-2xl p-4 text-left transition-[background-color,box-shadow,transform] duration-200 ease-sr active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                  on ? "bg-sr-surface shadow-[inset_0_0_0_2px_var(--sr-ink)]" : "bg-sr-hud hover:bg-sr-strong"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold">{person.name}</span>
                  <span className="font-srcond text-xs uppercase tracking-widest text-sr-ink2">{person.mode}</span>
                </span>
                <span className="mt-1 block text-sm leading-snug text-sr-ink2">{person.line}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["gmail", "calendar"] as const).map((which) => (
          <button key={which} type="button" disabled={!selected} aria-pressed={connected[which]} onClick={() => toggle(which)} className={FROSTED}>
            {connected[which] ? (which === "gmail" ? copy.connect.connectedGmail : copy.connect.connectedCalendar) : copy.connect[which]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-snug text-sr-ink2">{copy.connect.connectNote}</p>
    </div>
  );
}
