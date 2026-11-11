import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { classifyEmail } from "./classify";
import { FICTIONAL_COMPANIES, FOUNDER_FUNDS, FOUNDER_ORGS } from "./fictional";
import { INBOX_TODAY, OVERNIGHT, PINNED, generateInbox } from "./inbox";
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
    expect(pipelineFor("sam").stats.intros).toBe(4);
  });

  it("keeps each person's applied count where the overnight moves found it", () => {
    const applied = Object.fromEntries(KEYS.map((key) => [key, pipelineFor(key).stats.applied]));
    expect(applied).toEqual({ maya: 5, ravi: 60, sam: 90, lena: 40, dev: 500 });
  });

  it("lands every overnight move on an open application at least three days old, before the brief", () => {
    const real = new Set(getSnapshot().companies.map((company) => company.name.toLowerCase()));
    expect(OVERNIGHT.maya ?? []).toHaveLength(0);
    for (const key of KEYS) {
      const events = generateInbox(PEOPLE[key]).map(classifyEmail);
      for (const move of OVERNIGHT[key] ?? []) {
        const label = `${key} ${move.company} ${move.kind}`;
        expect(move.at >= `${INBOX_TODAY}T00:00:00.000Z` && move.at <= `${INBOX_TODAY}T07:00:00.000Z`, label).toBe(true);
        expect(real.has(move.company.toLowerCase()), label).toBe(false);
        const event = events.find((entry) => entry.company === move.company && entry.date === move.at);
        expect(event?.kind, label).toBe(move.kind);
        if (move.kind === "intro") {
          expect(FICTIONAL_COMPANIES, label).toContain(move.company);
          continue;
        }
        const exact = (entry: { company: string; role: string | null }) => entry.company === move.company && entry.role === move.role;
        const after = buildPipeline(events, INBOX_TODAY).rows.find(exact);
        expect(after?.lastEventAt, label).toBe(move.at);
        expect(after?.lane, label).toBe(move.founder ? "founder" : "jobs");
        expect(after?.exit, label).toBe(move.kind === "rejection" ? "rejected" : "open");
        if (move.kind !== "rejection") expect(after?.furthest, label).toBe(move.kind);
        const before = buildPipeline(events.filter((entry) => entry !== event), INBOX_TODAY).rows.find(exact);
        expect(before?.exit, label).toBe("open");
        const applied = events.find((entry) => exact(entry) && entry.kind === "applied");
        expect(Date.parse(move.at) - Date.parse(applied?.date ?? move.at), label).toBeGreaterThanOrEqual(3 * 86_400_000);
      }
    }
  });

  // Catches: a pinned event that never lands on its application, or one that leaks into another person's inbox.
  it("lands Sam's pinned events and leaves everyone else's inbox as it was", () => {
    expect(Object.keys(PINNED)).toEqual(["sam"]);
    const events = generateInbox(PEOPLE.sam).map(classifyEmail);
    const quiet = buildPipeline(events, INBOX_TODAY).rows.find((row) => row.company === "Vantablue" && row.role === "Full Stack Engineer");
    expect(quiet).toMatchObject({ furthest: "screen", exit: "open", lastEventAt: "2026-10-29T10:00:00.000Z" });
    expect(events.find((event) => event.company === "min/Max")).toMatchObject({ kind: "intro", date: "2026-11-05T16:20:00.000Z" });
    // sha256 of each inbox as generateInbox(PEOPLE[key]) built it at 61552bb, before PINNED existed.
    const before: Record<string, string> = {
      maya: "618acad58593744cfa9a7b71289e6fb9103776e67151223a400d34436ee68bb4",
      ravi: "997f60816a01e77f284fdd4f327465d4cf16005c0000c8d37d2dbb0df710beb0",
      lena: "3d342a8ab52396a3a2483fd56b21b09b117d217e8dd11c28dfe3b7a51c808ff8",
      dev: "b3e76052be07622c8a7f25b463c00298da5c18223034e24ae7dc55ed00a05eac",
    };
    for (const [key, digest] of Object.entries(before)) {
      const now = createHash("sha256").update(JSON.stringify(generateInbox(PEOPLE[key as PersonKey]))).digest("hex");
      expect(now, key).toBe(digest);
      expect(PINNED[key as PersonKey]).toBeUndefined();
    }
  });

  // Catches: appending the pinned events shifting an id the seeded generator already handed out.
  it("keeps every earlier id where it was when the pinned events are added", () => {
    const sam = generateInbox(PEOPLE.sam);
    const ids = sam.map((email) => email.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pinnedEmails = sam.slice(-(PINNED.sam?.length ?? 0));
    expect(pinnedEmails.map((email) => email.date)).toEqual((PINNED.sam ?? []).map((move) => move.at));
    expect(generateInbox(PEOPLE.sam, 2).some((email) => email.date === PINNED.sam?.[0].at)).toBe(false);
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

  it("gives every person a live thread past applied with a next step", () => {
    for (const key of KEYS) {
      const live = pipelineFor(key).rows.filter((row) => row.exit === "open" && row.furthest !== "applied" && row.next !== null);
      expect(live.length).toBeGreaterThan(0);
    }
    const maya = pipelineFor("maya").rows.find((row) => row.furthest === "assessment" && row.exit === "open");
    expect(maya?.next).toBe("Finish the assessment");
  });

  it("uses no fictional name that is a real company", () => {
    const names = FICTIONAL_COMPANIES.map((name) => name.toLowerCase());
    expect(names).not.toContain("greywing");
    expect(names).not.toContain("thistledown");
    for (const real of ["zinnia health", "xylem row", "fenwick seed fund", "silverbirch"]) {
      expect([...names, ...FOUNDER_ORGS.map((n) => n.toLowerCase())]).not.toContain(real);
    }
  });

  it("pairs accelerators with batch rounds and funds with pitch rounds", () => {
    for (const row of pipelineFor("dev").rows.filter((r) => r.lane === "founder")) {
      const isFund = FOUNDER_FUNDS.includes(row.company);
      expect(/pitch|seed/i.test(row.role ?? "")).toBe(isFund);
    }
  });

  it("keeps contact lines on example hosts", () => {
    for (const key of KEYS) {
      const contact = PEOPLE[key].resumeText.split("\n")[1];
      expect(contact).toMatch(/example/);
      expect(contact).not.toMatch(/github\.com|-sample/);
    }
  });
});
