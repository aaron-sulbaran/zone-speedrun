"use client";

import { useState, useSyncExternalStore } from "react";
import { MOTION, motion, type Motion } from "@/lib/speedrun/motion";
import { getMotionOverrides, resetMotionOverrides, setMotionOverrides, subscribeMotion } from "@/lib/speedrun/tuning";
import { motionJson, TUNING_PRESETS, TUNING_RANGES } from "@/lib/speedrun/tuningPresets";

// Dev only: SpeedrunExperience imports this behind NODE_ENV === "development"
// and ?tune, so production bundles never contain it. Its words live here, not in
// the content file, for the same reason; slider labels come from the Motion keys.
const keys = Object.keys(MOTION) as (keyof Motion)[];
const labelOf = (key: string) => key.replace(/([A-Z])/g, " $1").toLowerCase();

const buttonClass = "rounded-full border border-border px-3 py-1 font-label text-xs text-foreground hover:bg-glass";

function SliderRow({ name, value }: { name: keyof Motion; value: number }) {
  const { min, max, step } = TUNING_RANGES[name];
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-xs text-foreground">
      <span>{labelOf(name)}</span>
      <span className="tabular-nums">{value}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => setMotionOverrides({ [name]: Number(event.target.value) })}
        className="col-span-2 w-full accent-accent"
      />
    </label>
  );
}

export default function TuningPanel({ onReplay }: { onReplay: () => void }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  useSyncExternalStore(subscribeMotion, getMotionOverrides, getMotionOverrides);
  const values = motion();

  const copy = () => {
    const settle = (next: "ok" | "failed") => {
      setCopied(next);
      window.setTimeout(() => setCopied("idle"), 1200);
    };
    navigator.clipboard.writeText(motionJson(values)).then(() => settle("ok"), () => settle("failed"));
  };

  return (
    <div data-tuning-panel="" className="fixed bottom-4 right-4 z-[45] w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background p-3 shadow-lg">
      <button type="button" onClick={() => setOpen((on) => !on)} aria-expanded={open} className="flex w-full items-center justify-between font-label text-sm text-foreground">
        <span>Tune motion</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {TUNING_PRESETS.map((preset) => (
              <button key={preset.name} type="button" className={buttonClass} onClick={() => setMotionOverrides(preset.values)}>
                {preset.name}
              </button>
            ))}
          </div>
          <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
            {keys.map((key) => (
              <SliderRow key={key} name={key} value={values[key]} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={onReplay}>
              Replay the switch
            </button>
            <button type="button" className={buttonClass} onClick={resetMotionOverrides}>
              Reset
            </button>
            <button type="button" className={buttonClass} onClick={copy}>
              {copied === "ok" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy values"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
