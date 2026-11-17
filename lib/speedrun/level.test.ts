import { describe, expect, it } from "vitest";
import { earlyAsk, levelNote, type LevelNote } from "./level";
import { PEOPLE } from "./people";
import { snapshotSchema, type SnapshotRole } from "./snapshot";
import type { Intake } from "./types";

const role = (over: Partial<SnapshotRole>): SnapshotRole => ({
  id: "r1", company: "Co", companySlug: "co", title: "Software Engineer", location: "Remote", workplace: "Remote",
  fn: "engineering", seniority: null, tier: "a16z", cohort: null, compMin: null, compMax: null, compPeriod: null,
  postedAt: "2026-11-01", url: "https://example.com/job", excerpt: "", levelHints: [], descriptionRead: false, ...over,
});

const title = (word: string): LevelNote => ({ kind: "says", source: "title", word } as LevelNote);
const listing = (word: string): LevelNote => ({ kind: "says", source: "listing", word } as LevelNote);

const NOTES: [string, Partial<SnapshotRole>, LevelNote][] = [
  ["new grad in the title", { title: "Software Engineer, New Grad" }, title("new grad")],
  ["new grads, plural", { title: "New Grads wanted" }, title("new grad")],
  ["new graduate", { title: "New Graduate Engineer" }, title("new grad")],
  ["recent graduate", { title: "Recent Graduate Analyst" }, title("new grad")],
  ["recent grad", { title: "Recent Grad PM" }, title("new grad")],
  ["university grad", { title: "University Grad Engineer" }, title("new grad")],
  ["university graduates", { title: "University Graduates Program" }, title("new grad")],
  ["class of 2027", { title: "Engineer, Class of 2027" }, title("new grad")],
  ["2027 grad", { title: "2027 Grad Engineer" }, title("new grad")],
  ["co-op", { title: "Software Co-op" }, title("co-op")],
  ["coop", { title: "Product Coop" }, title("co-op")],
  ["co-ops, plural", { title: "Co-ops" }, title("co-op")],
  ["intern", { title: "Software Engineering Intern" }, title("intern")],
  ["interns, plural", { title: "Summer Interns" }, title("intern")],
  ["internship", { title: "Design Internship" }, title("intern")],
  ["early career", { title: "Early Career Engineer" }, title("early career")],
  ["early-career", { title: "Early-Career Engineer" }, title("early career")],
  ["entry level", { title: "Entry Level Analyst" }, title("entry level")],
  ["entry-level", { title: "Entry-Level Analyst" }, title("entry level")],
  ["a title word wins over the intern tag", { title: "New Grad Engineer", seniority: "intern" }, title("new grad")],
  ["a title word wins over listing hints", { title: "Engineer Intern", levelHints: ["5+ years of experience."] }, title("intern")],
  ["the intern tag", { seniority: "intern" }, { kind: "says", source: "tag", word: "intern" }],
  ["the junior tag", { seniority: "junior" }, { kind: "says", source: "tag", word: "junior" }],
  ["the tag wins over listing hints", { seniority: "junior", levelHints: ["We hire new grads."] }, { kind: "says", source: "tag", word: "junior" }],
  ["a listing hint naming new grads", { levelHints: ["We welcome new grads and career changers."] }, listing("new grad")],
  ["a listing hint naming co-ops", { levelHints: ["Open to co-op students."] }, listing("co-op")],
  ["the first matching hint", { levelHints: ["Open to interns.", "Open to co-ops."] }, listing("intern")],
  ["a hint that names new grads and asks for years says, not asks", { levelHints: ["New grads welcome, though 3+ years of experience helps."] }, listing("new grad")],
  ["3-5 years is 3", { levelHints: ["3-5 years of experience in backend work."] }, { kind: "asksYears", years: 3 }],
  ["5+ years of professional experience is 5", { levelHints: ["5+ years of professional experience."] }, { kind: "asksYears", years: 5 }],
  ["3 to 5 years is 3", { levelHints: ["3 to 5 years of experience."] }, { kind: "asksYears", years: 3 }],
  ["the smallest ask across hints", { levelHints: ["8+ years of experience.", "Ideally 4 years of relevant experience."] }, { kind: "asksYears", years: 4 }],
  ["1+ years is ignored", { levelHints: ["1+ years of experience."], descriptionRead: true }, { kind: "unstated", read: true }],
  ["years without experience is ignored", { levelHints: ["We have been around for 10 years."], descriptionRead: true }, { kind: "unstated", read: true }],
  ["Internal Tools is not an intern", { title: "Internal Tools Engineer" }, { kind: "unstated", read: false }],
  ["International Sales is not an intern", { title: "International Sales Lead" }, { kind: "unstated", read: false }],
  ["a title naming no level, description read", { descriptionRead: true }, { kind: "unstated", read: true }],
  ["a title naming no level, description not read", { descriptionRead: false }, { kind: "unstated", read: false }],
  ["a mid tag says nothing", { seniority: "mid" }, { kind: "unstated", read: false }],
];

describe("levelNote", () => {
  it.each(NOTES)("%s", (_name, over, expected) => {
    expect(levelNote(role(over))).toEqual(expected);
  });
});

const intake = (over: Partial<Intake>): Intake => ({ targets: [], places: [], why: "", ...over });
const ASKS: [string, Partial<Intake>, string | null][] = [
  ["interns", { asks: ["between"] }, "interns"],
  ["part-time students", { asks: ["during"] }, "part-time students"],
  ["co-ops", { asks: ["whileInSchool"] }, "co-ops"],
  ["new grads", { asks: ["afterGrad"] }, "new grads"],
  ["two, joined with or", { asks: ["whileInSchool", "afterGrad"] }, "co-ops or new grads"],
  ["three, commas then or", { asks: ["between", "whileInSchool", "afterGrad"] }, "interns, co-ops or new grads"],
  ["the fixed order whatever the click order", { asks: ["afterGrad", "between"] }, "interns or new grads"],
  ["a duplicate collapses", { asks: ["afterGrad", "afterGrad"] }, "new grads"],
  ["asks win over the intake seniority", { asks: ["afterGrad"], seniority: "intern" }, "new grads"],
  ["an empty asks falls back to seniority", { asks: [], seniority: "intern" }, "interns"],
  ["intake new_grad", { seniority: "new_grad" }, "new grads"],
  ["no asks, no seniority: the profile of an intern", {}, null],
];

describe("earlyAsk", () => {
  it.each(ASKS)("names %s", (_name, over, expected) => {
    // Dev is senior, so only the intake can make him an early-career visitor.
    expect(earlyAsk(PEOPLE.dev.profile, intake(over))).toBe(expected);
  });

  it("falls back to the profile's seniority", () => {
    expect(earlyAsk(PEOPLE.maya.profile, intake({}))).toBe("interns");
    expect(earlyAsk(PEOPLE.sam.profile, intake({}))).toBe("new grads");
  });

  it("is null for a visitor who is neither", () => {
    expect(earlyAsk(PEOPLE.dev.profile, intake({}))).toBeNull();
    expect(earlyAsk(PEOPLE.lena.profile, intake({}))).toBeNull();
  });
});

describe("the snapshot schema", () => {
  it("defaults the new fields on a role that predates them", () => {
    const old: Record<string, unknown> = { ...role({}) };
    delete old.levelHints;
    delete old.descriptionRead;
    const parsed = snapshotSchema.parse({ fetchedAt: "x", companies: [], portfolio: [], roles: [old] });
    expect(parsed.roles[0].levelHints).toEqual([]);
    expect(parsed.roles[0].descriptionRead).toBe(false);
  });
});
