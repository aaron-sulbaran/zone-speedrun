import { describe, expect, it } from "vitest";
import { composeBrief, renderBriefEmail, type BriefRole } from "./brief";
import { rolesFromIds, sampleBrief } from "./briefSample";
import { INBOX_TODAY } from "./inbox";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";
import { PERSON_KEYS } from "./types";

const NO_ROWS = { rows: [], stats: { applied: 0, inProcess: 0, intros: 0, offers: 0 } };
const role = (postedAt: string, tier: BriefRole["tier"] = "speedrun", id = "r1"): BriefRole => ({
  id, title: "Engineer", company: "Forgepoint", tier, postedAt, url: "https://example.com/r",
});
const assessment = (company: string) => ({ company, role: "Intern", lane: "jobs" as const, furthest: "assessment" as const, exit: "open" as const, lastEventAt: "2026-11-01T12:00:00.000Z", next: null });
const base = { firstName: "Sam", cadence: "daily" as const, today: INBOX_TODAY, pipeline: NO_ROWS, roles: [] as BriefRole[] };
const OLD_INTRO = { company: "Cobalt Meadow", date: "2026-10-03T12:00:00.000Z" };

describe("composeBrief", () => {
  it("allows one due item, and an old intro is standing, not moved", () => {
    const brief = composeBrief({ ...base, intros: [OLD_INTRO], pipeline: { ...NO_ROWS, rows: [assessment("Vantablue"), assessment("Zephyr Row")] } });
    expect(brief.items.filter((item) => item.kind === "due")).toHaveLength(1);
    expect(brief.items[0]).toMatchObject({ kind: "intro", standing: true, text: "Still waiting on a time with a founder at Cobalt Meadow." });
    expect(renderBriefEmail(brief, "Sam").subject).toBe("Sam, nothing new overnight. 2 things still open.");
  });

  it("counts an intro that landed overnight as moved", () => {
    const brief = composeBrief({ ...base, intros: [{ company: "Cobalt Meadow", date: "2026-11-07T01:00:00.000Z" }] });
    expect(brief.items[0].standing).toBeUndefined();
    expect(renderBriefEmail(brief, "Sam").subject).toBe("Sam, 1 thing moved overnight");
  });

  it("says a role is posted overnight, new this week, or just open, by its date", () => {
    const text = (postedAt: string) => composeBrief({ ...base, roles: [role(postedAt)] }).items[0];
    expect(text("2026-11-07T01:00:00.000Z")).toMatchObject({ text: expect.stringContaining("posted overnight") });
    expect(text("2026-11-07T01:00:00.000Z").standing).toBeUndefined();
    expect(text("2026-11-03T00:00:00.000Z")).toMatchObject({ text: expect.stringContaining("new this week"), standing: true });
    expect(text("2026-10-15T00:00:00.000Z")).toMatchObject({ text: "Engineer at Forgepoint is open and fits you.", standing: true });
  });

  it("never counts a future-dated role as new, and takes speedrun tier only", () => {
    expect(composeBrief({ ...base, roles: [role("2026-12-01T00:00:00.000Z")] }).items).toHaveLength(0);
    expect(composeBrief({ ...base, roles: [role("2026-11-07T01:00:00.000Z", "a16z")] }).items).toHaveLength(0);
    const brief = composeBrief({ ...base, roles: [role("2026-12-01T00:00:00.000Z", "speedrun", "a"), role("2026-10-20T00:00:00.000Z", "speedrun", "b")] });
    expect(brief.items[0].text).toContain("is open");
  });

  it("keeps an old intro and an old role out of an on-change brief", () => {
    const brief = composeBrief({ ...base, cadence: "on-change", intros: [OLD_INTRO], roles: [role("2026-10-15T00:00:00.000Z")] });
    expect(brief.items).toHaveLength(0);
  });

  it("orders intro, reply, due, new role", () => {
    const brief = composeBrief({
      ...base, intros: [{ company: "Cobalt Meadow", date: "2026-11-07T01:00:00.000Z" }], roles: [role("2026-11-07T02:00:00.000Z")],
      pipeline: {
        rows: [
          assessment("Nightfold"),
          { company: "Halcyon Works", role: "Engineer", lane: "jobs", furthest: "screen", exit: "open", lastEventAt: "2026-11-07T01:00:00.000Z", next: null },
        ],
        stats: { applied: 2, inProcess: 2, intros: 1, offers: 0 },
      },
    });
    expect(brief.items.map((item) => item.kind)).toEqual(["intro", "reply", "new-role", "due"]);
  });

  it("lists what moved first, then the standing intro, role and deadline, and hears a rejection as a reply", () => {
    const brief = composeBrief({
      ...base, intros: [OLD_INTRO], roles: [role("2026-10-15T00:00:00.000Z")],
      pipeline: {
        rows: [
          assessment("Nightfold"),
          { company: "Halcyon Works", role: "Engineer", lane: "jobs", furthest: "applied", exit: "rejected", lastEventAt: "2026-11-07T01:00:00.000Z", next: null },
        ],
        stats: { applied: 2, inProcess: 1, intros: 1, offers: 0 },
      },
    });
    expect(brief.items.map((item) => [item.kind, Boolean(item.standing)])).toEqual([
      ["reply", false], ["intro", true], ["new-role", true], ["due", true],
    ]);
    expect(renderBriefEmail(brief, "Sam").subject).toBe("Sam, 1 thing moved overnight");
  });

  it("agrees with its own body when only standing items remain", () => {
    const one = composeBrief({ ...base, roles: [role("2026-10-15T00:00:00.000Z")] });
    expect(renderBriefEmail(one, "Sam").subject).toBe("Sam, nothing new overnight. one role worth a look.");
    expect(renderBriefEmail(one, "").subject).toBe("Nothing new overnight. one role worth a look.");
  });
});

describe("rolesFromIds", () => {
  it("drops unknown ids and caps the list", () => {
    const [first, second] = getSnapshot().roles;
    expect(rolesFromIds(["nope", first.id, second.id]).map((r) => r.id)).toEqual([first.id, second.id]);
    expect(rolesFromIds(getSnapshot().roles.slice(0, 20).map((r) => r.id))).toHaveLength(6);
  });
});

describe("each sample person's brief", () => {
  const subjects: string[] = [];
  for (const key of PERSON_KEYS) {
    it(`${key}: stable, honest, one due at most, no dashes`, () => {
      const a = sampleBrief(key);
      const b = sampleBrief(key);
      const name = PEOPLE[key].profile.firstName;
      const out = renderBriefEmail(a, name);
      subjects.push(out.subject);
      expect(out.subject).toBe(renderBriefEmail(b, name).subject);
      expect(out.subject).toContain(name === "" ? "" : name);
      expect(a.items.filter((item) => item.kind === "due").length).toBeLessThanOrEqual(1);
      expect(a.items.length).toBeLessThanOrEqual(4);
      const moved = a.items.filter((item) => !item.standing).length;
      expect(moved > 0).toBe(key !== "maya");
      if (moved === 0 && a.items.length > 0) expect(out.subject).toContain("nothing new overnight");
      if (moved > 0) expect(out.subject).toMatch(new RegExp(`${moved} things? moved overnight`));
      const snapshotRoles = getSnapshot().roles;
      for (const item of a.items.filter((entry) => entry.kind === "new-role")) {
        const found = snapshotRoles.find((r) => r.url === item.href);
        expect(found?.tier).toBe("speedrun");
        if (item.text.includes("new this week") && found) {
          const age = Date.parse(`${INBOX_TODAY}T00:00:00Z`) + 86_400_000 - Date.parse(found.postedAt);
          expect(age).toBeLessThanOrEqual(7 * 86_400_000);
        }
      }
      expect(`${out.subject}\n${out.text}\n${out.html}`).not.toContain(String.fromCharCode(8212));
    });
  }

  it("gives the five people subjects that do not all share a shape", () => {
    const shapes = new Set(PERSON_KEYS.map((key) => renderBriefEmail(sampleBrief(key), PEOPLE[key].profile.firstName).subject.replace(PEOPLE[key].profile.firstName, "")));
    expect(shapes.size).toBeGreaterThan(2);
  });

  it("covers Dev as the one digest, Maya as on-change and quiet", () => {
    expect(PERSON_KEYS.filter((key) => PEOPLE[key].cadence === "digest")).toEqual(["dev"]);
    expect(sampleBrief("maya", { roleIds: [] }).items).toHaveLength(0);
    expect(sampleBrief("sam").items.map((item) => item.kind).slice(0, 3)).toEqual(["reply", "reply", "intro"]);
  });
});

describe("renderBriefEmail", () => {
  it("has no script, names the person, and a text part without tags", () => {
    const sam = renderBriefEmail(sampleBrief("sam"), "Sam");
    const maya = renderBriefEmail(sampleBrief("maya", { roleIds: [] }), "Maya");
    for (const out of [sam, maya]) {
      expect(out.html).not.toContain("<script");
      expect(out.text).not.toMatch(/<[^>]+>/);
    }
    expect(sam.html).toContain("Sam");
    expect(sam.subject).toContain("Sam");
    expect(sam.text).toContain("Sam");
    expect(maya.subject).toBe("Maya, nothing moved. that's fine.");
  });

  it("greets without a name when there is none", () => {
    const out = renderBriefEmail({ personKey: "you", date: INBOX_TODAY, cadence: "daily", items: [] }, "");
    expect(out.subject).toBe("Nothing moved. that's fine.");
    expect(out.text.startsWith("Morning.")).toBe(true);
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
