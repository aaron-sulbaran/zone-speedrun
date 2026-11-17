import { describe, expect, it } from "vitest";
import { extractProfile } from "./extract";
import { rankMatches } from "./match";
import { ownWords } from "./matchOwn";
import frozenBoard from "./fixtures/snapshot-2026-11-07.json";
import { PEOPLE } from "./people";
import { snapshotSchema } from "./snapshot";
import type { SnapshotRole } from "./snapshot";
import type { Intake, PersonKey, Profile } from "./types";

// A frozen board, so a fresh snapshot can move the demo but never these quality bars.
const corpus = snapshotSchema.parse(frozenBoard);

// Everyday words an own-words line must never rest on.
const EVERYDAY = new Set(
  "company companies new built build team teams work product products users user customers people answers answer time things thing make use used help real small good great role job grow growth learn".split(" "),
);

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

  it("puts a speedrun company on a board that has fewer than three role matches", () => {
    const { matches } = run("maya");
    expect(matches.length).toBeGreaterThanOrEqual(3);
    const companyOnly = matches.filter((m) => m.role === null);
    expect(companyOnly.length).toBeGreaterThanOrEqual(1);
    expect(companyOnly.length).toBeLessThanOrEqual(3 - matches.filter((m) => m.role !== null).length);
    // Role cards still rank first.
    expect(matches.findIndex((m) => m.role === null)).toBeGreaterThan(matches.map((m) => m.role !== null).lastIndexOf(true));
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

  it("never quotes a shipped item on the strength of ship or shipping, or on an everyday word", () => {
    for (const key of Object.keys(PEOPLE) as PersonKey[]) {
      for (const match of run(key, 100).matches) {
        for (const reason of match.reasons) {
          if (reason.text.startsWith("Your work on")) {
            expect(reason.text).not.toMatch(/mentions ship/i);
            const cited = reason.text.match(/mentions (\S+)\.$/)?.[1] ?? "";
            expect(EVERYDAY.has(cited.toLowerCase()), `${key}: ${reason.text}`).toBe(false);
          }
          const own = ownWords.get(reason);
          if (!own) continue;
          for (const word of own.words) expect(EVERYDAY.has(word), `${key}: ${word} in ${reason.text}`).toBe(false);
        }
      }
    }
  });

  it("sees a role labeled for a new grad in Ravi's six when one fits", () => {
    const { matches } = run("ravi");
    expect(matches.some((m) => /new grad/i.test(m.role?.title ?? "")), matches.map((m) => m.role?.title).join(" | ")).toBe(true);
  });

  it("leads a product-first new grad with a speedrun product role, and product before engineering", () => {
    const { matches } = run("sam");
    const titles = matches.map((m) => m.role?.title).join(" | ");
    expect(matches[0].role?.tier, titles).toBe("speedrun");
    expect(matches[0].role?.fn, titles).toBe("product");
    const firstOther = matches.findIndex((m) => m.role?.fn !== "product");
    expect(matches.slice(firstOther).every((m) => m.role?.fn !== "product"), titles).toBe(true);
  });

  it("quotes Sam on the domain he names", () => {
    const own = run("sam").matches.flatMap((m) => m.reasons.filter((r) => ownWords.has(r)));
    expect(own.length).toBeGreaterThan(0);
    for (const reason of own) expect(ownWords.get(reason)!.words.some((w) => /^(health|fintech)$/.test(w)), reason.text).toBe(true);
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

describe("rankMatches promotion, levels and ordering", () => {
  const NEWEST = "2026-11-01";
  let next = 0;
  const role = (over: Partial<SnapshotRole>): SnapshotRole => ({
    id: `r${(next += 1)}`, company: `Co ${next}`, companySlug: null, title: "Software Engineer", location: "Remote", workplace: "Remote",
    fn: "engineering", seniority: null, tier: "a16z", cohort: null, compMin: null, compMax: null, compPeriod: null,
    postedAt: NEWEST, url: "https://example.com/job", excerpt: "", levelHints: [], descriptionRead: false, ...over,
  });
  const base: Profile = { ...PEOPLE.ravi.profile, functions: ["engineering"], seniority: "mid", skills: ["Python", "Go"], shipped: [], locations: ["Remote"], remoteOk: true };
  const remoteEngineer: Intake = { targets: ["engineering"], places: ["Remote"], why: "" };

  it("moves a speedrun role that fits about as well into the top three", () => {
    const close = [1, 2, 3].map(() => role({ title: "Software Engineer, Python and Go" }));
    const speedrun = role({ title: "Software Engineer", tier: "speedrun" });
    const { matches } = rankMatches(base, remoteEngineer, { companies: [], roles: [...close, speedrun] });
    expect(matches.map((m) => m.role?.id).indexOf(speedrun.id)).toBe(2);
  });

  it("does not promote past a clearly better fit or a title that names what was asked for", () => {
    // Three points behind: out of the window.
    const far = [1, 2, 3].map(() => role({ title: "Software Engineer, Python and Go", seniority: "junior" }));
    const speedrun = role({ title: "Software Engineer", tier: "speedrun" });
    expect(rankMatches(base, remoteEngineer, { companies: [], roles: [...far, speedrun] }).matches.map((m) => m.role?.id).indexOf(speedrun.id)).toBe(3);
    // A point behind, but its title does not say engineering and the third card's does.
    const platform = [1, 2, 3].map(() => role({ title: "Platform Engineer" }));
    const manager = role({ title: "IT, Security, and Compliance Manager", tier: "speedrun" });
    const intake: Intake = { targets: ["data", "engineering"], places: ["Remote"], why: "" };
    const { matches } = rankMatches({ ...base, skills: [] }, intake, { companies: [], roles: [...platform, manager] });
    expect(matches.map((m) => m.role?.id).indexOf(manager.id)).toBe(3);
  });

  it("keeps an engineering-first new grad in Los Angeles on engineering roles at the top", () => {
    const profile: Profile = { ...base, seniority: "new_grad", skills: ["TypeScript", "React"], locations: ["Los Angeles", "Remote"] };
    const intake: Intake = { targets: ["engineering", "design"], places: ["Los Angeles", "Remote"], why: "" };
    const engineeringTop = (roles: SnapshotRole[]) => {
      const top = rankMatches(profile, intake, { companies: corpus.companies, roles }).matches.slice(0, 3);
      for (const m of top) expect(m.reasons[0].text, m.role?.title).toMatch(/^You asked for engineering/);
      expect(top.some((m) => /designer/i.test(m.role?.title ?? ""))).toBe(false);
    };
    engineeringTop(corpus.roles);
    // Only design roles left at speedrun companies: none of them may jump an engineering card.
    engineeringTop(corpus.roles.filter((r) => !(r.tier === "speedrun" && r.fn !== "design")));
    const louisiana = rankMatches(profile, intake, corpus, 100).matches.filter((m) => /, LA\b/.test(m.role?.location ?? ""));
    expect(louisiana).toEqual([]);
  });

  it("keeps Member of Technical Staff roles in the engineering tier", () => {
    const profile: Profile = { ...base, seniority: "senior", locations: ["San Francisco"] };
    const intake: Intake = { targets: ["engineering"], places: ["San Francisco"], why: "" };
    const staff = rankMatches(profile, intake, corpus, 200).matches.filter((m) => /member of technical staff/i.test(m.role?.title ?? ""));
    expect(staff.length).toBeGreaterThan(0);
    for (const m of staff) expect(m.reasons[0].cites, m.role?.title).toContain("title");
  });

  it("orders cards by what they show once a repeated own-words line is dropped", () => {
    const old = "2026-09-02";
    const rust = [1, 2, 3].map((n) => role({ id: `rust-${n}`, title: "Backend Engineer", excerpt: "We write Rust compilers.", postedAt: old }));
    const plain = role({ id: "plain", title: "Backend Engineer", excerpt: "We write services." });
    const why: Intake = { ...remoteEngineer, why: "Rust compilers" };
    const { matches } = rankMatches({ ...base, skills: [] }, why, { companies: [], roles: [...rust, plain] });
    expect(matches.map((m) => m.role?.id)).toEqual([rust[0].id, rust[1].id, plain.id, rust[2].id]);
    expect(matches[3].reasons.some((r) => r.text.startsWith("You wrote"))).toBe(false);
    expect(matches[3].score).toBeLessThan(matches[2].score);
  });

  it("gives a title that names the visitor's level a modest edge", () => {
    const profile: Profile = { ...base, seniority: "new_grad" };
    const plain = role({ title: "Software Engineer" });
    const named = role({ title: "Software Engineer, New Grad" });
    const { matches } = rankMatches(profile, remoteEngineer, { companies: [], roles: [plain, named] });
    expect(matches[0].role?.id).toBe(named.id);
    expect(matches[0].score - matches[1].score).toBeLessThanOrEqual(4);
  });

  it("does not quote a visitor on the word software alone", () => {
    const listing = role({ title: "Software Engineer", excerpt: "We build software for clinics." });
    const intake: Intake = { ...remoteEngineer, why: "Robotics, autonomy and hardware-software integration" };
    const { matches } = rankMatches({ ...base, skills: [] }, intake, { companies: [], roles: [listing] });
    expect(matches[0].reasons.some((r) => ownWords.has(r))).toBe(false);
  });

  it("gives hardware titles the penalty for a software visitor, even when they say engineer", () => {
    const profile: Profile = { ...base, seniority: "new_grad", skills: ["TypeScript", "React"], locations: ["Austin", "Remote"] };
    const intake: Intake = { targets: ["engineering"], places: ["Austin", "Remote"], why: "A full-stack new grad role" };
    const titles = rankMatches(profile, intake, corpus).matches.map((m) => m.role?.title ?? "");
    for (const title of titles) expect(/^(systems|mechanical|electrical) engineer/i.test(title.trim()), titles.join(" | ")).toBe(false);
    const systems = role({ title: "Systems Engineer I" });
    const web = role({ title: "Web Engineer" });
    const weak = rankMatches(profile, remoteEngineer, { companies: [], roles: [systems, web] }).matches;
    expect(weak[0].role?.id).toBe(web.id);
    expect(weak[0].score - weak[1].score).toBeGreaterThanOrEqual(7);
  });

  it("needs a skill or a domain word before quoting the visitor", () => {
    const listing = role({ title: "Software Engineer", excerpt: "A new company where the team builds product for users." });
    const intake: Intake = { ...remoteEngineer, why: "A new company where the team builds product for users" };
    const { matches } = rankMatches({ ...base, skills: [], shipped: ["Helper (answers questions for a company team)"] }, intake, { companies: [], roles: [listing] });
    expect(matches[0].reasons.some((r) => ownWords.has(r)), matches[0].reasons.map((r) => r.text).join(" / ")).toBe(false);
  });
});

describe("rankMatches with the visitor's student and founding answers", () => {
  const sam = PEOPLE.sam.profile;
  const maya = PEOPLE.maya.profile;
  const internRole: SnapshotRole = {
    id: "intern-1", company: "Intern Co", companySlug: null, title: "Software Engineering Intern", location: "Remote", workplace: "Remote",
    fn: "engineering", seniority: "intern", tier: "a16z", cohort: null, compMin: null, compMax: null, compPeriod: null,
    postedAt: "2026-11-01", url: "https://example.com/job", excerpt: "", levelHints: [], descriptionRead: false,
  };
  const base: Intake = { targets: ["engineering"], places: ["Remote"], why: "" };

  it("ranks with the answered seniority over the profile's own", () => {
    const corpusOfOne = { companies: [], roles: [internRole] };
    expect(rankMatches(sam, base, corpusOfOne).matches).toHaveLength(0);
    const withIntern = rankMatches(sam, { ...base, seniority: "intern" }, corpusOfOne);
    expect(withIntern.matches.map((m) => m.role?.id)).toEqual(["intern-1"]);
  });

  it("says an area title is an opening, not a person they are hiring", () => {
    const areaRole: SnapshotRole = { ...internRole, id: "area-1", title: "Product", fn: "product", seniority: null };
    const intake: Intake = { ...PEOPLE.sam.intake, targets: ["product"], places: [] };
    const { matches } = rankMatches(sam, intake, { companies: [], roles: [areaRole] });
    const texts = matches[0].reasons.map((r) => r.text);
    expect(texts[0]).toBe('You asked for product, and they have an opening listed as "Product".');
    expect(texts.some((t) => t.includes("hiring a Product"))).toBe(false);
  });

  it("matches today's result when seniority is absent", () => {
    const person = PEOPLE.sam;
    expect(rankMatches(sam, person.intake, corpus)).toEqual(rankMatches(sam, { ...person.intake }, corpus));
  });

  it("returns the founder routes when the visitor said they would found, whatever the resume says", () => {
    expect(maya.founderSignal.score).toBeLessThan(0.6);
    expect(rankMatches(maya, PEOPLE.maya.intake, corpus).routes).toEqual([]);
    expect(rankMatches(maya, { ...PEOPLE.maya.intake, founding: true }, corpus).routes.map((r) => r.kind).sort()).toEqual(["alpha", "speedrun"]);
  });
});

describe("the level line", () => {
  const samIntake = PEOPLE.sam.intake;
  const run = (key: PersonKey, intake: Intake = PEOPLE[key].intake) => rankMatches(PEOPLE[key].profile, intake, corpus);

  it("tells Sam, on every role match, whether the listing takes co-ops or new grads", () => {
    const withRole = run("sam").matches.filter((m) => m.role);
    expect(withRole.length).toBeGreaterThan(0);
    for (const match of withRole) {
      expect(match.level, match.role!.title).not.toBeNull();
      const { kind, text } = match.level!;
      // The ask is named only where the line says the listing is silent.
      if (kind === "unstated") expect(text).toContain("co-ops or new grads");
      expect(match.level!.chip.length).toBeGreaterThan(0);
    }
    expect(withRole.some((m) => m.level!.kind === "unstated")).toBe(true);
  });

  it("gives Dev, who asked for no early-career level, no level line", () => {
    const { matches } = run("dev");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.level === null)).toBe(true);
  });

  it("gives a company-only card no level line", () => {
    const companyOnly = ["maya", "ravi", "sam"].flatMap((key) => run(key as PersonKey).matches).filter((m) => m.role === null);
    expect(companyOnly.length).toBeGreaterThan(0);
    expect(companyOnly.every((m) => m.level === null)).toBe(true);
  });

  it("leaves Sam's order and scores alone whatever asks he carries", () => {
    const bare: Intake = { targets: samIntake.targets, places: samIntake.places, why: samIntake.why };
    const key = (intake: Intake) => run("sam", intake).matches.map((m) => `${m.role?.id ?? m.company.slug}:${m.score}`);
    expect(key({ ...bare, asks: ["between"] })).toEqual(key(samIntake));
    expect(run("sam", bare).matches.map((m) => m.role?.id ?? m.company.slug)).toEqual(run("sam").matches.map((m) => m.role?.id ?? m.company.slug));
  });

  it("reads a role that names its level in the title as the title's word", () => {
    const internRole = { ...corpus.roles[0], id: "lvl", companySlug: null, title: "Software Engineering Intern", seniority: "intern", fn: "engineering", location: "Remote", workplace: "Remote", postedAt: "2026-11-01" };
    const out = rankMatches(PEOPLE.maya.profile, { targets: ["engineering"], places: ["Remote"], why: "", seniority: "intern", asks: ["between"] }, { companies: [], roles: [internRole] });
    expect(out.matches[0].level).toEqual({ kind: "says", text: "The title says intern.", chip: "Says intern" });
  });
});
