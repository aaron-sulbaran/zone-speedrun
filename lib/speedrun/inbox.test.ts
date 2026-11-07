import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import { FICTIONAL_COMPANIES, FOUNDER_ORGS } from "./fictional";
import { INBOX_TODAY, generateInbox } from "./inbox";
import { PEOPLE } from "./people";
import { buildPipeline } from "./pipeline";
import { getSnapshot } from "./snapshot";
import type { PersonKey } from "./types";

const KEYS = Object.keys(PEOPLE) as PersonKey[];

function pipelineFor(key: PersonKey) {
  return buildPipeline(generateInbox(PEOPLE[key]).map(classifyEmail), INBOX_TODAY);
}

describe("generateInbox", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    expect(generateInbox(PEOPLE.sam, 7)).toEqual(generateInbox(PEOPLE.sam, 7));
    expect(generateInbox(PEOPLE.sam, 7)).not.toEqual(generateInbox(PEOPLE.sam, 8));
  });

  for (const key of KEYS) {
    it(`gives ${key} a pipeline whose applied count is within 10 percent of volume`, () => {
      const { stats } = pipelineFor(key);
      const volume = PEOPLE[key].volume;
      expect(Math.abs(stats.applied - volume)).toBeLessThanOrEqual(Math.ceil(volume * 0.1));
    });
  }

  it("gives Sam a real looking funnel", () => {
    const events = generateInbox(PEOPLE.sam).map(classifyEmail);
    const count = (kind: string) => events.filter((event) => event.kind === kind).length;
    expect(count("assessment")).toBeGreaterThanOrEqual(12);
    expect(count("assessment")).toBeLessThanOrEqual(18);
    expect(count("interview")).toBeGreaterThanOrEqual(6);
    expect(count("interview")).toBeLessThanOrEqual(10);
    expect(count("offer")).toBe(2);
    expect(pipelineFor("sam").stats.intros).toBe(2);
  });

  it("gives Dev a founder lane with accelerator and fund threads", () => {
    const rows = pipelineFor("dev").rows;
    expect(rows.some((row) => row.lane === "founder")).toBe(true);
    expect(PEOPLE.dev.profile.founderSignal.score).toBeGreaterThanOrEqual(0.7);
  });

  it("only uses fictional companies and never a real speedrun company", () => {
    const real = new Set(getSnapshot().companies.map((company) => company.name.toLowerCase()));
    expect(FICTIONAL_COMPANIES.length).toBeGreaterThanOrEqual(60);
    for (const name of [...FICTIONAL_COMPANIES, ...FOUNDER_ORGS]) expect(real.has(name.toLowerCase())).toBe(false);
    const allowed = new Set([...FICTIONAL_COMPANIES, ...FOUNDER_ORGS].map((name) => name.toLowerCase()));
    for (const key of KEYS) {
      for (const row of pipelineFor(key).rows) {
        expect(allowed.has(row.company.toLowerCase())).toBe(true);
      }
      for (const message of generateInbox(PEOPLE[key])) {
        const text = `${message.from} ${message.subject} ${message.body}`.toLowerCase();
        for (const name of real) {
          if (name.length < 5) continue;
          expect(text.includes(name)).toBe(false);
        }
      }
    }
  });
});

describe("PEOPLE", () => {
  it("writes each resume as plain text of 250 to 450 words led by a name", () => {
    for (const key of KEYS) {
      const person = PEOPLE[key];
      const words = person.resumeText.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(250);
      expect(words).toBeLessThanOrEqual(450);
      const firstLine = person.resumeText.trim().split("\n")[0];
      expect(firstLine.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(person.profile.source).toBe("sample");
      expect(person.profile.firstName.length).toBeGreaterThan(0);
    }
  });
});
