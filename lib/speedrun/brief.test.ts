import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content/speedrun";
import { parsePasted, todayEvents } from "./board";
import { composeBrief, renderBriefEmail, type BriefRole } from "./brief";
import { rolesFromIds, sampleBrief } from "./briefSample";
import { classifyEmail } from "./classify";
import { FOUNDER_ORGS } from "./fictional";
import { generateInbox, INBOX_TODAY, OVERNIGHT } from "./inbox";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";
import { PERSON_KEYS, type AppRow } from "./types";

const copy = speedrunCopy.brief;
const NO_ROWS = { rows: [], stats: { applied: 0, inProcess: 0, intros: 0, offers: 0 } };
const role = (postedAt: string, tier: BriefRole["tier"] = "speedrun", id = "r1"): BriefRole => ({
  id, title: "Engineer", company: "Forgepoint", tier, postedAt, url: "https://example.com/r",
});
const row = (company: string, furthest: AppRow["furthest"], exit: AppRow["exit"], lastEventAt: string, extra: Partial<AppRow> = {}): AppRow => ({
  company, role: "Engineer", lane: "jobs", furthest, exit, lastEventAt, next: null, ...extra,
});
const assessment = (company: string) => row(company, "assessment", "open", "2026-11-01T12:00:00.000Z", { role: "Intern" });
const rows = (list: AppRow[]) => ({ rows: list, stats: { applied: list.length, inProcess: list.length, intros: 0, offers: 0 } });
const base = { firstName: "Sam", cadence: "daily" as const, today: INBOX_TODAY, pipeline: NO_ROWS, roles: [] as BriefRole[] };
const OVERNIGHT_AT = "2026-11-07T03:00:00.000Z";
const OLD_INTRO = { company: "Cobalt Meadow", date: "2026-10-03T12:00:00.000Z" };
const RECENT_INTRO = { company: "Cobalt Meadow", date: "2026-11-01T12:00:00.000Z" };

describe("composeBrief", () => {
  it("allows one due item, and a recent intro is standing, not moved", () => {
    const brief = composeBrief({ ...base, intros: [RECENT_INTRO], pipeline: rows([assessment("Vantablue"), assessment("Zephyr Row")]) });
    expect(brief.items.filter((item) => item.kind === "due")).toHaveLength(1);
    expect(brief.items[0]).toMatchObject({ kind: "intro", standing: true, text: "Pick a time with the founder at Cobalt Meadow." });
    expect(renderBriefEmail(brief, "Sam").subject).toBe("Sam, nothing new overnight. 2 things still open.");
  });

  it("counts an intro that landed overnight as moved", () => {
    const brief = composeBrief({ ...base, intros: [{ company: "Cobalt Meadow", date: "2026-11-07T01:00:00.000Z" }] });
    expect(brief.items[0]).toMatchObject({ kind: "intro", text: "A founder replied to your intro at Cobalt Meadow. Pick a time." });
    expect(brief.items[0].standing).toBeUndefined();
    expect(renderBriefEmail(brief, "Sam").subject).toBe("Sam, 1 thing moved overnight");
  });

  it("words each reply by what it says, and keeps the kind a reply", () => {
    const say = (entry: AppRow) => {
      const [item] = composeBrief({ ...base, pipeline: rows([entry]) }).items;
      expect(item.kind).toBe("reply");
      return item.text;
    };
    expect(say(row("Halcyon Works", "applied", "rejected", OVERNIGHT_AT))).toBe("Halcyon Works passed on Engineer.");
    expect(say(row("Halcyon Works", "interview", "rejected", OVERNIGHT_AT))).toBe("Halcyon Works passed on Engineer.");
    expect(say(row("Halcyon Works", "interview", "open", OVERNIGHT_AT))).toBe("Halcyon Works wants to interview you for Engineer.");
    expect(say(row("Halcyon Works", "assessment", "open", OVERNIGHT_AT))).toBe("Halcyon Works sent a take-home for Engineer.");
    expect(say(row("Halcyon Works", "screen", "open", OVERNIGHT_AT))).toBe("Halcyon Works wants a quick call about Engineer.");
    expect(say(row("Halcyon Works", "offer", "open", OVERNIGHT_AT))).toBe("Halcyon Works sent an offer for Engineer.");
    expect(say(row("Halcyon Works", "applied", "rejected", OVERNIGHT_AT, { role: null }))).toBe("Halcyon Works passed on your application.");
    expect(say(row("Halcyon Works", "interview", "open", OVERNIGHT_AT, { role: null }))).toBe("Halcyon Works wants to interview you.");
    const fund = { lane: "founder" as const, role: "Seed intro" };
    expect(say(row("Oriel Partners", "screen", "open", OVERNIGHT_AT, fund))).toBe("Oriel Partners wants an intro call.");
    expect(say(row("Oriel Partners", "interview", "open", OVERNIGHT_AT, fund))).toBe("Oriel Partners invited you to a partner meeting.");
    expect(say(row("Oriel Partners", "screen", "rejected", OVERNIGHT_AT, fund))).toBe("Oriel Partners passed this round.");
  });

  it("counts only what moved since midnight and before the 8:02 send", () => {
    const brief = composeBrief({
      ...base,
      intros: [{ company: "Pinewick", date: "2026-11-07T09:00:00.000Z" }],
      roles: [role("2026-11-07T09:00:00.000Z")],
      pipeline: rows([
        row("Halcyon Works", "screen", "open", "2026-11-06T23:30:00.000Z"),
        row("Quillbright", "interview", "open", "2026-11-07T07:59:00.000Z"),
        row("Tessel Harbor", "applied", "rejected", "2026-11-07T08:30:00.000Z"),
      ]),
    });
    expect(brief.items.map((item) => item.text)).toEqual(["Quillbright wants to interview you for Engineer."]);
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
    const brief = composeBrief({ ...base, cadence: "on-change", intros: [RECENT_INTRO], roles: [role("2026-10-15T00:00:00.000Z")] });
    expect(brief.items).toHaveLength(0);
  });

  it("drops a standing intro older than 14 days", () => {
    expect(composeBrief({ ...base, intros: [OLD_INTRO] }).items).toHaveLength(0);
    const thirteenDays = { company: "Cobalt Meadow", date: "2026-10-25T12:00:00.000Z" };
    expect(composeBrief({ ...base, intros: [thirteenDays] }).items).toHaveLength(1);
  });

  it("orders what moved as intro, replies, then a role posted overnight, and stops at three", () => {
    const brief = composeBrief({
      ...base, intros: [{ company: "Cobalt Meadow", date: "2026-11-07T01:00:00.000Z" }], roles: [role("2026-11-07T02:00:00.000Z")],
      pipeline: rows([assessment("Nightfold"), row("Halcyon Works", "screen", "open", "2026-11-07T01:00:00.000Z")]),
    });
    expect(brief.items.map((item) => item.kind)).toEqual(["intro", "reply", "new-role"]);
  });

  it("lists what moved first, then the standing intro, role and deadline, at most three", () => {
    const standing = { ...base, intros: [RECENT_INTRO], roles: [role("2026-10-15T00:00:00.000Z")] };
    const quiet = composeBrief({ ...standing, pipeline: rows([assessment("Nightfold")]) });
    expect(quiet.items.map((item) => [item.kind, Boolean(item.standing)])).toEqual([["intro", true], ["new-role", true], ["due", true]]);
    const moved = composeBrief({ ...standing, pipeline: rows([assessment("Nightfold"), row("Halcyon Works", "applied", "rejected", OVERNIGHT_AT)]) });
    expect(moved.items.map((item) => [item.kind, Boolean(item.standing)])).toEqual([["reply", false], ["intro", true], ["new-role", true]]);
    expect(renderBriefEmail(moved, "Sam").subject).toBe("Sam, 1 thing moved overnight");
  });

  it("never lets a standing intro hide a moved reply from the same company", () => {
    const brief = composeBrief({ ...base, intros: [RECENT_INTRO], pipeline: rows([row("Cobalt Meadow", "interview", "open", OVERNIGHT_AT)]) });
    expect(brief.items).toEqual([{ kind: "reply", text: "Cobalt Meadow wants to interview you for Engineer.", href: null }]);
  });

  it("agrees with its own body when only standing items remain", () => {
    const one = composeBrief({ ...base, roles: [role("2026-10-15T00:00:00.000Z")] });
    expect(renderBriefEmail(one, "Sam").subject).toBe("Sam, nothing new overnight. one role worth a look.");
    expect(renderBriefEmail(one, "").subject).toBe("Nothing new overnight. one role worth a look.");
    expect(Object.keys(copy.stillOpen)).not.toContain("reply");
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
  const SENT_AT = Date.parse(`${INBOX_TODAY}T08:02:00Z`);
  for (const key of PERSON_KEYS) {
    it(`${key}: stable, honest, one due at most, no dashes`, () => {
      const a = sampleBrief(key);
      const b = sampleBrief(key);
      const name = PEOPLE[key].profile.firstName;
      const out = renderBriefEmail(a, name);
      expect(out.subject).toBe(renderBriefEmail(b, name).subject);
      expect(out.subject).toContain(name === "" ? "" : name);
      expect(a.items.filter((item) => item.kind === "due").length).toBeLessThanOrEqual(1);
      expect(a.items.length).toBeLessThanOrEqual(3);
      const moved = a.items.filter((item) => !item.standing).length;
      expect(moved > 0).toBe(key !== "maya");
      if (moved === 0 && a.items.length > 0) expect(out.subject).toContain("nothing new overnight");
      if (moved > 0) expect(out.subject).toMatch(new RegExp(`${moved} things? moved overnight`));
      const snapshotRoles = getSnapshot().roles;
      for (const item of a.items.filter((entry) => entry.kind === "new-role")) {
        const found = snapshotRoles.find((r) => r.url === item.href);
        expect(found?.tier).toBe("speedrun");
        if (item.text.includes("new this week") && found) {
          expect(SENT_AT - Date.parse(found.postedAt)).toBeLessThanOrEqual(7 * 86_400_000);
        }
      }
      expect(`${out.subject}\n${out.text}\n${out.html}`).not.toContain(String.fromCharCode(8212));
    });

    it(`${key}: every moved item names a company on the Today card above it`, () => {
      const today = todayEvents(generateInbox(PEOPLE[key]).map(classifyEmail), INBOX_TODAY).slice(0, 6);
      for (const item of sampleBrief(key).items.filter((entry) => !entry.standing)) {
        expect(today.some((event) => item.text.includes(event.company)), item.text).toBe(true);
      }
    });
  }

  it("gives the five people subjects that do not all share a shape", () => {
    const shapes = new Set(PERSON_KEYS.map((key) => renderBriefEmail(sampleBrief(key), PEOPLE[key].profile.firstName).subject.replace(PEOPLE[key].profile.firstName, "")));
    expect(shapes.size).toBeGreaterThan(2);
  });

  it("covers Dev as the one digest, Maya as on-change and quiet", () => {
    expect(PERSON_KEYS.filter((key) => PEOPLE[key].cadence === "digest")).toEqual(["dev"]);
    expect(sampleBrief("maya", { roleIds: [] }).items).toHaveLength(0);
  });

  it("leads Sam's brief with a founder's reply to his intro", () => {
    const intro = (OVERNIGHT.sam ?? []).find((move) => move.kind === "intro");
    expect(intro).toBeDefined();
    const brief = sampleBrief("sam");
    expect(brief.items[0]).toEqual({ kind: "intro", text: copy.items.intro(intro?.company ?? ""), href: null });
    expect(brief.items.map((item) => item.kind)).toEqual(["intro", "reply", "reply"]);
  });

  it("gives Dev a moved line from his founder lane", () => {
    const moved = sampleBrief("dev").items.filter((item) => !item.standing);
    expect(moved.some((item) => FOUNDER_ORGS.some((org) => item.text.startsWith(org)))).toBe(true);
  });

  it("hears a pasted reply in this morning's brief, as the preview does", () => {
    const email = parsePasted("From: Halcyon Works Hiring <hiring@halcyonworks.example>\nSubject: Interview invitation: Software Engineer\n\nWe would like to invite you to a final round interview.\nRole: Software Engineer");
    expect(email).not.toBeNull();
    const brief = sampleBrief("maya", { extraEvents: email ? [classifyEmail(email)] : [], roleIds: [] });
    expect(brief.items.map((item) => item.text)).toEqual(["Halcyon Works wants to interview you for Software Engineer."]);
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

  it("calls the preview this morning's brief", () => {
    expect(copy.heading).toBe("this morning, 8:02 am");
  });
});
