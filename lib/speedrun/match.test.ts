import { describe, expect, it } from "vitest";
import { extractProfile } from "./extract";
import { rankMatches } from "./match";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";
import type { PersonKey } from "./types";

const corpus = getSnapshot();

function run(key: PersonKey) {
  const person = PEOPLE[key];
  const profile = extractProfile(person.resumeText, person.intake);
  return rankMatches(profile, person.intake, corpus);
}

describe("rankMatches", () => {
  it("gives Lena design matches at the top", () => {
    const { matches } = run("lena");
    expect(matches.length).toBeGreaterThanOrEqual(3);
    for (const match of matches.slice(0, 3)) {
      expect(match.role).not.toBeNull();
      const role = match.role!;
      expect(role.fn === "design" || /design/i.test(role.title)).toBe(true);
      const cited = match.reasons.flatMap((r) => r.cites);
      expect(cited.includes("functions") || cited.includes("title")).toBe(true);
    }
  });

  it("gives Dev both founder routes", () => {
    const { routes } = run("dev");
    expect(routes.map((r) => r.kind).sort()).toEqual(["alpha", "speedrun"]);
    expect(routes.find((r) => r.kind === "speedrun")?.url).toBe("https://speedrun.a16z.com/apply");
    expect(routes.find((r) => r.kind === "alpha")?.url).toBe("https://speedrun.a16z.com/alpha");
  });

  it("gives no routes to people without a founder signal", () => {
    expect(run("maya").routes).toEqual([]);
    expect(run("lena").routes).toEqual([]);
  });

  it("keeps Maya on intern or new grad roles, or company-only matches", () => {
    const { matches } = run("maya");
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      if (match.role === null) continue;
      const ok =
        match.role.seniority === "intern" ||
        match.role.seniority === "junior" ||
        /intern|new grad|early career/i.test(match.role.title);
      expect(ok).toBe(true);
    }
  });

  for (const key of ["maya", "ravi", "sam", "lena", "dev"] as PersonKey[]) {
    it(`${key}: every match has a cited reason and the funnel counts hold`, () => {
      const { matches, narrowing } = run(key);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.length).toBeLessThanOrEqual(6);
      const slugs = matches.map((m) => m.company.name);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const match of matches) {
        expect(match.reasons.length).toBeGreaterThan(0);
        for (const reason of match.reasons) {
          expect(reason.text.length).toBeGreaterThan(0);
          expect(reason.cites.length).toBeGreaterThan(0);
        }
        expect(match.connect.includes("apply")).toBe(match.role !== null);
        expect(match.company.slug).not.toBe("speedrun");
      }
      expect(narrowing.shown).toBe(matches.length);
      expect(narrowing.shown).toBeLessThanOrEqual(narrowing.afterFilters);
      expect(narrowing.afterFilters).toBeLessThanOrEqual(narrowing.roles);
      expect(narrowing.companies).toBe(corpus.companies.length - 1);
    });
  }

  it("returns nothing, honestly, when the filters leave nothing", () => {
    const person = PEOPLE.lena;
    const profile = extractProfile(person.resumeText, person.intake);
    const result = rankMatches(profile, { ...person.intake, places: ["Nowhereville"] }, {
      companies: corpus.companies,
      roles: corpus.roles,
    });
    expect(result.matches).toEqual([]);
    expect(result.narrowing.shown).toBe(0);
  });

  it("decides AI from the title or description, never from a company name", () => {
    const { matches } = run("ravi");
    const names = (m: (typeof matches)[number]) =>
      [m.role!.company, m.company.name].reduce((t, n) => t.replace(new RegExp(n.replace(/[()]/g, ""), "gi"), " "), `${m.role!.title} ${m.role!.excerpt}`);
    // Ravi's second target is engineering; only the matches placed under AI must mention it.
    const asAi = matches.filter((m) => m.reasons[0].text.startsWith("You asked for AI"));
    expect(asAi.length).toBeGreaterThanOrEqual(3);
    expect(matches.slice(0, 3)).toEqual(asAi.slice(0, 3));
    for (const match of asAi) {
      expect(match.role).not.toBeNull();
      expect(/\b(ai|ml|machine learning|llms?|language models?|generative|neural|nlp)\b/i.test(names(match))).toBe(true);
    }
  });

  it("keeps remote roles in other regions away from US visitors", () => {
    const foreign = /europe|emea|\buk\b|united kingdom|london|lisbon|asia|apac|singapore|india|japan|australia|sydney|latin america|latam|brazil|belgrade|makati|philippines|dublin|munich|abu dhabi/i;
    for (const key of ["sam", "lena"] as PersonKey[]) {
      for (const match of run(key).matches) {
        expect(foreign.test(match.role?.location ?? "")).toBe(false);
      }
    }
  });

  it("does not depend on corpus order", () => {
    const person = PEOPLE.dev;
    const profile = extractProfile(person.resumeText, person.intake);
    const forward = rankMatches(profile, person.intake, corpus);
    const reversed = rankMatches(profile, person.intake, { companies: corpus.companies, roles: [...corpus.roles].reverse() });
    expect(reversed.matches.map((m) => m.role?.id)).toEqual(forward.matches.map((m) => m.role?.id));
  });

  it("ranks the demo profiles as they ship", () => {
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      const person = PEOPLE[key];
      const { matches } = rankMatches(person.profile, person.intake, corpus);
      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        expect(match.reasons.length).toBeGreaterThan(0);
        expect(match.reasons.every((r) => r.cites.length > 0)).toBe(true);
      }
    }
  });

  it("writes plain titles and articles in reasons", () => {
    for (const key of ["maya", "ravi", "sam", "lena", "dev"] as PersonKey[]) {
      for (const match of run(key).matches) {
        const text = match.reasons.map((r) => r.text).join(" ");
        expect(text).not.toMatch(/\ba (AI|ML|SRE|Early|Engineer|Unified)\b/);
        expect(text).not.toMatch(/ - [A-Z][a-z]+ \(Remote\)/);
        expect(text).not.toMatch(/You said/);
      }
    }
  });
});
