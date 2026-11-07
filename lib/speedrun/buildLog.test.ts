import { describe, expect, it } from "vitest";
import { composeBuildLog, timingFor } from "./buildLog";
import { rankMatches } from "./match";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";

function logFor(key: "sam" | "dev") {
  const person = PEOPLE[key];
  const result = rankMatches(person.profile, person.intake, getSnapshot());
  return { person, result, lines: composeBuildLog(person.intake, person.profile, result) };
}

describe("composeBuildLog", () => {
  it("quotes Sam's own answers", () => {
    const { person, lines } = logFor("sam");
    const text = lines.map((l) => l.text).join("\n");
    expect(person.intake.targets.some((t) => text.includes(t))).toBe(true);
    expect(text).toContain("Atlanta, New York, Remote");
    expect(text).toContain("A co-op or new grad role");
    const found = lines.find((l) => l.text.startsWith("found: "))!;
    expect(found.text.split(", ").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the narrowing counts", () => {
    const { result, lines } = logFor("sam");
    const scanning = lines.find((l) => l.text.startsWith("scanning"))!;
    expect(scanning.text).toContain(String(result.narrowing.roles));
    expect(scanning.text).toContain(String(result.narrowing.companies));
    const text = lines.map((l) => l.text).join("\n");
    expect(text).toContain(`${result.narrowing.afterFilters} fit`);
    expect(text).toContain(`${result.narrowing.shown} worth`);
  });

  it("ends with the made-for line, with strictly increasing times under 8 s", () => {
    const { lines } = logFor("sam");
    const last = lines[lines.length - 1];
    expect(last.tone).toBe("made");
    expect(last.text).toContain("Sam");
    for (let i = 1; i < lines.length; i++) expect(lines[i].at).toBeGreaterThan(lines[i - 1].at);
    expect(last.at).toBeLessThan(8000);
  });

  it("keeps the why fragment to 60 characters", () => {
    const { lines } = logFor("sam");
    const why = lines.find((l) => l.text.startsWith("why: "))!;
    expect(why.text.length).toBeLessThanOrEqual(60 + 3 + 'why: ""'.length);
    expect(why.text).toContain('..."');
  });

  it("lands the whole beat between 6 and 8 s for every sample person", () => {
    for (const key of Object.keys(PEOPLE) as (keyof typeof PEOPLE)[]) {
      const person = PEOPLE[key];
      const result = rankMatches(person.profile, person.intake, getSnapshot());
      const end = timingFor(composeBuildLog(person.intake, person.profile, result)).end;
      expect(end, key).toBeGreaterThanOrEqual(6000);
      expect(end, key).toBeLessThanOrEqual(8000);
    }
  });

  it("still takes 6 s or more with empty answers", () => {
    const { person, result } = logFor("sam");
    const lines = composeBuildLog({ targets: [], places: [], why: "" }, person.profile, result);
    expect(timingFor(lines).end).toBeGreaterThanOrEqual(6000);
  });

  it("never shows a single skill", () => {
    const { person, result } = logFor("sam");
    const one = { ...person.profile, skills: ["Go"] };
    const lines = composeBuildLog(person.intake, one, result);
    expect(lines.some((l) => l.text.startsWith("found:"))).toBe(false);
  });

  it("skips lines for answers the visitor left empty", () => {
    const { person, result } = logFor("sam");
    const lines = composeBuildLog({ targets: [], places: [], why: "" }, person.profile, result);
    expect(lines.some((l) => /^(targets|places|why):/.test(l.text))).toBe(false);
    expect(lines[lines.length - 1].tone).toBe("made");
  });
});
