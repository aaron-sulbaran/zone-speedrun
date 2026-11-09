import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rankMatches } from "./match";
import { PEOPLE } from "./people";
import { snapshotSchema } from "./snapshot";
import { FNS, type Fn, type Intake, type Profile } from "./types";
import real from "./snapshot.json";
import standIn from "./snapshot.public.json";

// The public mirror ships this made-up snapshot in place of the real one (see
// scripts/public-repo/public-export.json). This file compares against the real
// snapshot, so the export denies it; it only runs in the private repo.
const parsed = snapshotSchema.parse(standIn);
const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("public stand-in snapshot", () => {
  it("parses with the real schema and has an ISO fetchedAt", () => {
    expect(snapshotSchema.safeParse(standIn).success).toBe(true);
    expect(parsed.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(parsed.fetchedAt))).toBe(false);
  });

  it("names no company, slug or portfolio entry that the real snapshot has", () => {
    const realNames = new Set<string>();
    const realSlugs = new Set<string>();
    for (const c of real.companies) {
      realNames.add(norm(c.name));
      realSlugs.add(c.slug);
    }
    for (const r of real.roles) realNames.add(norm(r.company));
    for (const p of real.portfolio) realNames.add(norm(p.name));
    const mine = [
      ...parsed.companies.filter((c) => c.slug !== "speedrun").map((c) => c.name),
      ...parsed.roles.filter((r) => r.companySlug !== "speedrun").map((r) => r.company),
      ...parsed.portfolio.map((p) => p.name),
    ];
    for (const name of mine) expect(realNames.has(norm(name)), name).toBe(false);
    for (const c of parsed.companies.filter((x) => x.slug !== "speedrun")) expect(realSlugs.has(c.slug), c.slug).toBe(false);
  });

  it("quotes no real role id, url or excerpt", () => {
    const realIds = new Set(real.roles.map((r) => r.id));
    const realExcerpts = new Set(real.roles.map((r) => r.excerpt));
    for (const r of parsed.roles) {
      expect(realIds.has(r.id)).toBe(false);
      expect(realExcerpts.has(r.excerpt)).toBe(false);
      expect(r.url).not.toContain("speedrun-talent-network");
    }
    for (const c of parsed.companies) expect(c.url).not.toContain("speedrun-talent-network");
  });

  it("points every logo at a placeholder mark that exists, never a company logo", () => {
    for (const c of parsed.companies) {
      expect(c.logo, c.slug).toBe(`/speedrun/standin/${c.slug}.svg`);
      expect(existsSync(path.join(process.cwd(), "public", c.logo!)), c.logo!).toBe(true);
    }
  });

  it("has the fund, interns, new grads and a founding role", () => {
    expect(parsed.companies.some((c) => c.slug === "speedrun")).toBe(true);
    expect(parsed.roles.some((r) => r.seniority === "intern")).toBe(true);
    expect(parsed.roles.some((r) => r.seniority === "junior" || /new grad/i.test(r.title))).toBe(true);
    expect(parsed.roles.some((r) => r.seniority === "founding")).toBe(true);
    expect(parsed.companies.length).toBeGreaterThanOrEqual(8);
    expect(parsed.roles.length).toBeGreaterThanOrEqual(20);
  });

  it.each(FNS)("gives a %s target at least one match", (fn: Fn) => {
    const profile: Profile = { ...PEOPLE.sam.profile, functions: [fn], seniority: fn === "founder" ? "senior" : "mid" };
    const intake: Intake = { targets: [fn], places: [], why: "" };
    expect(rankMatches(profile, intake, parsed).matches.length).toBeGreaterThan(0);
  });

  it("keeps the demo usable for Sam", () => {
    expect(rankMatches(PEOPLE.sam.profile, PEOPLE.sam.intake, parsed).matches.length).toBeGreaterThan(0);
  });
});
