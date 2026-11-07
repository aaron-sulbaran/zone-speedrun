import { describe, expect, it } from "vitest";
import { extractProfile } from "./extract";
import { rankMatches } from "./match";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";
import type { PersonKey } from "./types";

const corpus = getSnapshot();

type Mode = "extracted" | "sample";

// The demo serves the sample profiles; uploads serve extracted ones. Quality holds on both.
function profileFor(mode: Mode, key: PersonKey) {
  const person = PEOPLE[key];
  return mode === "sample" ? person.profile : extractProfile(person.resumeText, person.intake);
}

describe.each(["extracted", "sample"] as Mode[])("rankMatches (%s profiles)", (mode) => {
  const run = (key: PersonKey, limit = 6) => rankMatches(profileFor(mode, key), PEOPLE[key].intake, corpus, limit);

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

  const stripCompany = (m: ReturnType<typeof run>["matches"][number]) =>
    [m.role!.company, m.company.name].reduce((t, n) => t.replace(new RegExp(n.replace(/[()]/g, ""), "gi"), " "), `${m.role!.title} ${m.role!.excerpt}`);
  const AI_TEXT = /\b(ai|ml|machine learning|llms?|language models?|generative|neural|nlp)\b/i;

  it("shows an AI-first visitor only roles that mention AI in the title or description", () => {
    const { matches } = run("ravi");
    expect(matches).toHaveLength(6);
    for (const match of matches) {
      expect(match.role).not.toBeNull();
      expect(AI_TEXT.test(stripCompany(match))).toBe(true);
    }
    const wide = run("ravi", 100).matches;
    expect(wide.filter((m) => m.role && AI_TEXT.test(stripCompany(m))).length).toBeGreaterThanOrEqual(11);
  });

  it("keeps roles outside the US and generic remote away from every sample person", () => {
    const outside = /canada|toronto|mexico|spain|madrid|switzerland|zurich|turkey|istanbul|vietnam|china|korea|seoul|india\b|europe|\buk\b|united kingdom|london|lisbon|asia|apac|singapore|japan|australia|sydney|latin america|latam|brazil|belgrade|makati|philippines|dublin, ireland|munich|abu dhabi/i;
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      const person = PEOPLE[key];
      for (const match of run(key, 100).matches) {
        const named = person.intake.places.some((p) => outside.test(p));
        const location = match.role?.location ?? "";
        const alsoUs = /united states|\busa\b|, (AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/.test(location);
        if (!named && !alsoUs) expect(outside.test(location), `${key}: ${location}`).toBe(false);
      }
    }
  });

  it("puts software titles ahead of hardware titles for engineering targets", () => {
    const software = /software|developer|backend|frontend|full.?stack|platform|mobile|ios|android|infrastructure|data|ml|machine learning|ai/i;
    for (const match of run("maya").matches) if (match.role) expect(software.test(match.role.title), match.role.title).toBe(true);
    const hardware = /mechanical|electrical|hardware|naval|manufactur|propulsion|avionics|civil|chemical/i;
    for (const key of ["ravi", "sam"] as PersonKey[]) {
      for (const match of run(key).matches) {
        if (match.role && match.reasons[0].text.startsWith("You asked for engineering")) {
          expect(hardware.test(match.role.title), match.role.title).toBe(false);
        }
      }
    }
    // Within a company the software role wins on title, not on recency.
    const base = run("maya", 100).matches.find((m) => m.company.name === "Base Power Company");
    if (base?.role) expect(/software/i.test(base.role.title), base.role.title).toBe(true);
  });

  const ownLine = (text: string) => text.startsWith("You wrote") || text.startsWith("Your work on");

  it("quotes the visitor in at least three of the five top sixes, and never repeats a line past twice", () => {
    let people = 0;
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      const lines = run(key).matches.flatMap((m) => m.reasons.map((r) => r.text).filter(ownLine));
      if (lines.length > 0) people += 1;
      for (const line of lines) expect(lines.filter((l) => l === line).length).toBeLessThanOrEqual(2);
    }
    expect(people).toBeGreaterThanOrEqual(3);
  });

  it("matches words, never substrings, in own-words reasons", () => {
    const base = corpus.roles.find((r) => r.tier === "speedrun")!;
    const role = { ...base, title: "Relationship Manager", excerpt: "We manage the relationship with Google and capital partners.", location: "Remote", workplace: "Remote", fn: "engineering", seniority: "junior" };
    const person = PEOPLE.ravi;
    const profile = { ...person.profile, skills: ["Go", "api"], shipped: ["Ship tracker"], functions: ["engineering" as const] };
    const result = rankMatches(profile, { targets: ["engineering"], places: ["Remote"], why: "I like an api and ship things" }, { companies: [], roles: [role] });
    const text = result.matches.flatMap((m) => m.reasons.map((r) => r.text)).join(" ");
    expect(result.matches).toHaveLength(1);
    expect(text).not.toMatch(/You shipped|You wrote|Your Go|Your api/);
  });

  it("ranks a visitor who skipped places from the resume city without dropping to nothing", () => {
    const person = PEOPLE.lena;
    const resume = person.resumeText.replace("Brooklyn, NY |", "Product Designer | Design Systems | Brooklyn, NY |");
    const profile = extractProfile(resume, { ...person.intake, places: [] });
    expect(profile.locations).toEqual(["New York"]);
    expect(rankMatches(profile, { ...person.intake, places: [] }, corpus).matches.length).toBeGreaterThan(0);
    const headlineOnly = extractProfile(person.resumeText.replace("Brooklyn, NY |", "Product Designer | Design Systems |"), { ...person.intake, places: [] });
    expect(headlineOnly.locations).toEqual([]);
    expect(rankMatches(headlineOnly, { ...person.intake, places: [] }, corpus).matches.length).toBeGreaterThan(0);
  });

  it("does not depend on corpus order", () => {
    const person = PEOPLE.dev;
    const profile = extractProfile(person.resumeText, person.intake);
    const forward = rankMatches(profile, person.intake, corpus);
    const reversed = rankMatches(profile, person.intake, { companies: corpus.companies, roles: [...corpus.roles].reverse() });
    expect(reversed.matches.map((m) => m.role?.id)).toEqual(forward.matches.map((m) => m.role?.id));
  });

  it("puts a speedrun company in the top three whenever a speedrun role fits", () => {
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      const wide = run(key, 100).matches;
      if (!wide.some((m) => m.role?.tier === "speedrun")) continue;
      expect(run(key).matches.slice(0, 3).some((m) => m.role?.tier === "speedrun"), key).toBe(true);
    }
  });

  it("never quotes a shipped item on the strength of ship or shipping", () => {
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      for (const match of run(key, 100).matches) {
        for (const reason of match.reasons) {
          if (reason.text.startsWith("Your work on")) expect(reason.text).not.toMatch(/mentions ship/i);
        }
      }
    }
  });

  it("writes grammatical skills reasons", () => {
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      for (const match of run(key, 100).matches) {
        const text = match.reasons.map((r) => r.text).join(" ");
        expect(text).not.toMatch(/comes up in|shows up in|You shipped/);
      }
    }
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
