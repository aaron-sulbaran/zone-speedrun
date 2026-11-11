import { describe, expect, it } from "vitest";
import { DESK_SAMPLES, FINISHED_SAMPLE, LEARNED, LEARNED_FROM_SAMPLE, RIVALS, rivalsFor, type DeskStage } from "./deskSamples";
import { FICTIONAL_COMPANIES } from "./fictional";
import type { Match } from "./match";
import snapshot from "./snapshot.json";
import { FNS } from "./types";

function match(name: string, fn: string | null): Match {
  return {
    company: { name, slug: name.toLowerCase(), logo: null, cohort: null, stage: null, blurb: "blurb" },
    role: fn === null ? null : ({ id: `${name}-role`, fn, title: "A role" } as Match["role"]),
    score: 1,
    reasons: [],
    connect: ["intro"],
  };
}

describe("sample data", () => {
  it("names only fictional companies, never a real one", () => {
    // Catches: an invented outcome at a real company
    const real = new Set(snapshot.companies.map((c) => c.name.toLowerCase()));
    for (const company of [...DESK_SAMPLES.map((c) => c.company), FINISHED_SAMPLE.card.company]) {
      expect(FICTIONAL_COMPANIES).toContain(company);
      expect(real.has(company.toLowerCase())).toBe(false);
    }
  });

  it("fills each stage with 2, 2, 1, 2, 2 cards", () => {
    const count = (stage: DeskStage) => DESK_SAMPLES.filter((c) => c.stage === stage).length;
    expect(["requested", "withFounder", "connected", "tracking", "outcome"].map((s) => count(s as DeskStage))).toEqual([2, 2, 1, 2, 2]);
  });

  it("makes the finished sample one of the outcome cards, hired", () => {
    expect(FINISHED_SAMPLE.card.pill).toBe("hired");
    expect(DESK_SAMPLES.filter((c) => c.stage === "outcome")).toContainEqual(FINISHED_SAMPLE.card);
    expect(FINISHED_SAMPLE.timeline.length).toBe(5);
  });

  it("keeps card ids unique", () => {
    const ids = DESK_SAMPLES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries three learned lines, one a people miss", () => {
    expect(LEARNED).toHaveLength(3);
    expect(LEARNED.filter((l) => l.includes("matching unchanged"))).toHaveLength(1);
    expect(LEARNED_FROM_SAMPLE.length).toBeGreaterThan(0);
  });
});

describe("rivalsFor", () => {
  it("has at least 2 rivals for every function and the default", () => {
    for (const key of [...FNS, "default"] as const) expect(RIVALS[key].length).toBeGreaterThanOrEqual(2);
  });

  it("returns 2, the same 2 each time, from the role's function pool", () => {
    const m = match("Halcyon Works", "design");
    const first = rivalsFor(m);
    expect(first).toHaveLength(2);
    expect(rivalsFor(m)).toEqual(first);
    for (const rival of first) expect(RIVALS.design).toContainEqual(rival);
  });

  it("falls back to the default pool for no role or an unknown function", () => {
    for (const m of [match("Quillbright", null), match("Quillbright", "plumbing")]) {
      for (const rival of rivalsFor(m)) expect(RIVALS.default).toContainEqual(rival);
    }
  });

  it("never lets a rival id equal a sample card id", () => {
    // Catches: a rival that becomes a card on the desk
    const cardIds = new Set(DESK_SAMPLES.map((c) => c.id));
    for (const rival of Object.values(RIVALS).flat()) expect(cardIds.has(rival.id)).toBe(false);
  });

  it("names no company in a rival line", () => {
    const real = snapshot.companies.map((c) => c.name.toLowerCase());
    for (const rival of Object.values(RIVALS).flat()) {
      const text = `${rival.headline} ${rival.whyThem} ${rival.whyRole} ${rival.project}`.toLowerCase();
      for (const name of real) expect(text.includes(name)).toBe(false);
    }
  });
});
