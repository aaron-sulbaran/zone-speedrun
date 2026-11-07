import { describe, expect, it } from "vitest";
import { composeBrief, renderBriefEmail } from "./brief";
import { sampleBrief } from "./briefSample";
import type { MatchResult } from "./match";
import { INBOX_TODAY } from "./inbox";

const EMPTY: MatchResult = { matches: [], routes: [], narrowing: { companies: 0, roles: 0, afterFilters: 0, shown: 0 } };
const NO_ROWS = { rows: [], stats: { applied: 0, inProcess: 0, intros: 0, offers: 0 } };
const matchPosted = (postedAt: string, tier: "speedrun" | "a16z" = "speedrun") =>
  ({
    company: { name: "Forgepoint", slug: "forgepoint", logo: null, cohort: null, stage: null, blurb: "" },
    role: { id: "r", company: "Forgepoint", companySlug: "forgepoint", title: "Engineer", location: null, workplace: null, fn: null, seniority: null, tier, cohort: null, compMin: null, compMax: null, compPeriod: null, postedAt, url: "https://example.com/r", excerpt: "" },
    score: 1,
    reasons: [],
    connect: [],
  }) as MatchResult["matches"][number];
const assessment = (company: string) => ({ company, role: "Intern", lane: "jobs" as const, furthest: "assessment" as const, exit: "open" as const, lastEventAt: "2026-11-01T12:00:00.000Z", next: null });

describe("composeBrief", () => {
  it("allows one due item, and the subject counts only what changed", () => {
    const brief = composeBrief({
      firstName: "Sam", cadence: "daily", today: INBOX_TODAY, result: EMPTY,
      intros: [{ company: "Cobalt Meadow", date: "2026-10-03T12:00:00.000Z" }],
      pipeline: { ...NO_ROWS, rows: [assessment("Vantablue"), assessment("Zephyr Row")] },
    });
    expect(brief.items.filter((item) => item.kind === "due")).toHaveLength(1);
    expect(renderBriefEmail(brief, "Sam").subject).toBe("Sam, 1 thing moved overnight");
  });

  it("uses a role posted in the window, else the freshest speedrun match as new this week", () => {
    const base = { firstName: "Sam", cadence: "daily" as const, today: INBOX_TODAY, pipeline: NO_ROWS };
    const fresh = composeBrief({ ...base, result: { ...EMPTY, matches: [matchPosted("2026-11-07T01:00:00.000Z")] } });
    expect(fresh.items[0]).toMatchObject({ kind: "new-role", text: expect.stringContaining("posted overnight") });
    const old = composeBrief({ ...base, result: { ...EMPTY, matches: [matchPosted("2026-10-01T00:00:00.000Z")] } });
    expect(old.items[0].text).toContain("new this week");
    expect(old.items[0].standing).toBe(true);
    const future = composeBrief({ ...base, result: { ...EMPTY, matches: [matchPosted("2026-12-01T00:00:00.000Z", "a16z")] } });
    expect(future.items).toHaveLength(0);
  });

  it("keeps an old intro out of an on-change brief", () => {
    const brief = composeBrief({
      firstName: "Dee", cadence: "on-change", today: INBOX_TODAY, result: EMPTY, pipeline: NO_ROWS,
      intros: [{ company: "Cobalt Meadow", date: "2026-10-03T12:00:00.000Z" }],
    });
    expect(brief.items).toHaveLength(0);
  });

  it("greets without a name when there is none", () => {
    const out = renderBriefEmail({ personKey: "you", date: INBOX_TODAY, cadence: "daily", items: [] }, "");
    expect(out.subject).toBe("Nothing moved. that's fine.");
    expect(out.text.startsWith("Morning.")).toBe(true);
  });

  it("gives Sam at most three items, led by an intro", () => {
    const brief = sampleBrief("sam");
    expect(brief.items.length).toBeGreaterThan(0);
    expect(brief.items.length).toBeLessThanOrEqual(3);
    expect(brief.items[0].kind).toBe("intro");
  });

  it("gives Maya, on change, nothing when the pipeline has not moved", () => {
    const brief = sampleBrief("maya", { result: EMPTY });
    expect(brief.cadence).toBe("on-change");
    expect(brief.items).toHaveLength(0);
    expect(brief.date).toBe(INBOX_TODAY);
  });

  it("orders intro, reply, due, new role", () => {
    const brief = composeBrief({
      firstName: "Ada",
      cadence: "daily",
      today: INBOX_TODAY,
      intros: [{ company: "Cobalt Meadow", date: "2026-11-07T01:00:00.000Z" }],
      pipeline: {
        rows: [
          { company: "Nightfold", role: "Intern", lane: "jobs", furthest: "assessment", exit: "open", lastEventAt: "2026-11-01T12:00:00.000Z", next: null },
          { company: "Halcyon Works", role: "Engineer", lane: "jobs", furthest: "screen", exit: "open", lastEventAt: "2026-11-07T01:00:00.000Z", next: null },
        ],
        stats: { applied: 2, inProcess: 2, intros: 1, offers: 0 },
      },
      result: EMPTY,
    });
    expect(brief.items.map((item) => item.kind)).toEqual(["intro", "reply", "due"]);
  });
});

describe("renderBriefEmail", () => {
  it("has no script, names the person, and a text part without tags", () => {
    const sam = renderBriefEmail(sampleBrief("sam"), "Sam");
    const maya = renderBriefEmail(sampleBrief("maya", { result: EMPTY }), "Maya");
    for (const out of [sam, maya]) {
      expect(out.html).not.toContain("<script");
      expect(out.text).not.toMatch(/<[^>]+>/);
    }
    expect(sam.html).toContain("Sam");
    expect(sam.subject).toContain("Sam");
    expect(sam.text).toContain("Sam");
    expect(maya.subject).toBe("Maya, nothing moved. that's fine.");
  });

  it("escapes markup in any name or company", () => {
    const out = renderBriefEmail(
      { personKey: "you", date: INBOX_TODAY, cadence: "daily", items: [{ kind: "reply", text: "<b>x</b> replied.", href: null }] },
      "<i>Ada</i>",
    );
    expect(out.html).not.toContain("<b>x");
    expect(out.html).not.toContain("<i>Ada");
  });

  it("only links to https addresses", () => {
    const out = renderBriefEmail(
      { personKey: "you", date: INBOX_TODAY, cadence: "daily", items: [{ kind: "new-role", text: "Role.", href: "javascript:alert(1)" }] },
      "Ada",
    );
    expect(out.html).not.toContain("javascript:");
  });
});
