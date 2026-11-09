import { describe, expect, it } from "vitest";
import { MOTION, type Motion } from "./motion";
import { motionJson, TUNING_PRESETS, TUNING_RANGES } from "./tuningPresets";

const keys = Object.keys(MOTION) as (keyof Motion)[];

describe("tuning presets", () => {
  it("puts the approved sweep first, equal to MOTION", () => {
    expect(TUNING_PRESETS[0].name).toBe("Approved sweep");
    expect(TUNING_PRESETS[0].values).toEqual(MOTION);
  });

  it("makes Snappy differ from MOTION only in its six keys", () => {
    const snappy = TUNING_PRESETS.find((preset) => preset.name === "Snappy");
    expect(snappy).toBeDefined();
    const changed = keys.filter((key) => snappy!.values[key] !== MOTION[key]).sort();
    expect(changed).toEqual(["cardInMs", "cascadeStaggerMs", "coverMs", "holdMs", "revealMs", "stepMs"].sort());
    expect(snappy!.values).toMatchObject({ coverMs: 360, holdMs: 80, revealMs: 420, cascadeStaggerMs: 40, stepMs: 280, cardInMs: 260 });
  });

  it("round-trips through flat JSON in MOTION key order", () => {
    const json = motionJson(MOTION);
    expect(JSON.parse(json)).toEqual(MOTION);
    expect(Object.keys(JSON.parse(json))).toEqual(keys);
    expect(json).toContain('\n  "coverMs": 480');
  });

  it("keeps every MOTION value inside its range, and every preset too", () => {
    for (const preset of TUNING_PRESETS) {
      for (const key of keys) {
        const { min, max, step } = TUNING_RANGES[key];
        expect(step).toBeGreaterThan(0);
        expect(preset.values[key]).toBeGreaterThanOrEqual(min);
        expect(preset.values[key]).toBeLessThanOrEqual(max);
      }
    }
    expect(Object.keys(TUNING_RANGES)).toEqual(keys);
  });
});
