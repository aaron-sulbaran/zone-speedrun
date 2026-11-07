import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { rerank, readResume } from "./ai";
import type { Match, MatchResult } from "./match";
import type { Intake, Profile } from "./types";

const intake: Intake = { targets: ["engineering"], places: [], why: "" };

function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 10, text: 10, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

const throwingModel = new MockLanguageModelV4({
  doGenerate: async () => {
    throw new Error("model down");
  },
});

const validProfile = {
  firstName: "Ada",
  headline: "Backend engineer",
  functions: ["engineering"],
  seniority: "junior",
  skills: ["TypeScript"],
  shipped: ["A billing API"],
  locations: ["Austin"],
  remoteOk: false,
  founderSignal: { score: 0.1, evidence: [] },
};

const RESUME = "Ada Lovelace\nSKILLS\nTypeScript, Postgres\nEXPERIENCE\nBuilt a billing API in TypeScript.";

describe("readResume", () => {
  it("returns the model profile when the object is valid", async () => {
    const out = await readResume({ text: RESUME, intake }, { model: modelReturning(JSON.stringify(validProfile)) });
    expect(out.mode).toBe("model");
    expect(out.profile.source).toBe("model");
    expect(out.profile.firstName).toBe("Ada");
  });

  it("falls back to the rules reader when the model throws", async () => {
    const out = await readResume({ text: RESUME, intake }, { model: throwingModel });
    expect(out.mode).toBe("rules");
    expect(out.profile.source).toBe("rules");
  });

  it("falls back when the object is invalid", async () => {
    const bad = JSON.stringify({ ...validProfile, seniority: "wizard" });
    const out = await readResume({ text: RESUME, intake }, { model: modelReturning(bad) });
    expect(out.mode).toBe("rules");
  });

  it("falls back when the output is not JSON", async () => {
    const out = await readResume({ text: RESUME, intake }, { model: modelReturning("sorry, no") });
    expect(out.mode).toBe("rules");
  });

  it("uses the rules reader when there is no model", async () => {
    const out = await readResume({ text: RESUME, intake }, { model: null });
    expect(out.mode).toBe("rules");
  });
});

function match(name: string, withRole = true): Match {
  return {
    company: { name, slug: name.toLowerCase(), logo: null, cohort: null, stage: null, blurb: `${name} builds things` },
    role: withRole
      ? {
          id: name, company: name, companySlug: name.toLowerCase(), title: `${name} engineer`, location: "Austin",
          workplace: null, fn: "engineering", seniority: "junior", tier: "speedrun", cohort: null, compMin: null,
          compMax: null, compPeriod: null, postedAt: "2026-01-01", url: "https://example.com", excerpt: "Ship code.",
        }
      : null,
    score: 1,
    reasons: [{ text: `${name} original`, cites: ["title"] }],
    connect: ["intro"],
  };
}

const result: MatchResult = {
  matches: [match("Alpha"), match("Beta"), match("Gamma", false)],
  routes: [],
  narrowing: { companies: 3, roles: 2, afterFilters: 3, shown: 3 },
};
const profile = { ...validProfile, source: "model" } as Profile;

describe("rerank", () => {
  it("reorders and keeps reasons that cite real fields", async () => {
    const reply = {
      ranked: [
        { index: 1, reasons: [{ text: "Beta fits your level.", cites: ["seniority", "title"] }] },
        { index: 0, reasons: [] },
      ],
    };
    const out = await rerank(profile, result, { model: modelReturning(JSON.stringify(reply)) });
    expect(out.matches.map((m) => m.company.name)).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(out.matches[0].reasons).toEqual([{ text: "Beta fits your level.", cites: ["seniority", "title"] }]);
    expect(out.matches[1].reasons[0].text).toBe("Alpha original");
  });

  it("drops a reason with empty cites", async () => {
    const reply = { ranked: [{ index: 0, reasons: [{ text: "Sounds great.", cites: [] }] }, { index: 1, reasons: [] }] };
    const out = await rerank(profile, result, { model: modelReturning(JSON.stringify(reply)) });
    expect(out.matches[0].reasons[0].text).toBe("Alpha original");
  });

  it("drops a reason citing a field the match does not have", async () => {
    const reply = {
      ranked: [
        { index: 2, reasons: [{ text: "Great title.", cites: ["title"] }, { text: "Their blurb fits.", cites: ["blurb"] }] },
        { index: 0, reasons: [{ text: "Made up.", cites: ["nonsense"] }] },
      ],
    };
    const out = await rerank(profile, result, { model: modelReturning(JSON.stringify(reply)) });
    expect(out.matches[0].company.name).toBe("Gamma");
    expect(out.matches[0].reasons).toEqual([{ text: "Their blurb fits.", cites: ["blurb"] }]);
    expect(out.matches[1].reasons[0].text).toBe("Alpha original");
  });

  it("ignores bad and repeated indexes and keeps skipped matches", async () => {
    const reply = { ranked: [{ index: 9, reasons: [] }, { index: 1, reasons: [] }, { index: 1, reasons: [] }] };
    const out = await rerank(profile, result, { model: modelReturning(JSON.stringify(reply)) });
    expect(out.matches.map((m) => m.company.name)).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("returns the input when the model throws, is invalid, or is absent", async () => {
    expect(await rerank(profile, result, { model: throwingModel })).toBe(result);
    expect(await rerank(profile, result, { model: modelReturning("nope") })).toBe(result);
    expect(await rerank(profile, result, { model: null })).toBe(result);
  });
});
