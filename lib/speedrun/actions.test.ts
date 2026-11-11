import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import { introCards, needsYou, rowAction, todayActions, type Action } from "./actions";
import { classifyEmail } from "./classify";
import { DETAILS } from "./details";
import { INBOX_TODAY, generateInbox } from "./inbox";
import { createRequest } from "./introRequest";
import type { Match } from "./match";
import { PEOPLE } from "./people";
import { buildPipeline } from "./pipeline";
import type { AppRow, Intake, PersonKey } from "./types";

const copy = speedrunCopy.actions;

function inboxOf(key: PersonKey) {
  const events = generateInbox(PEOPLE[key]).map(classifyEmail);
  return { events, pipeline: buildPipeline(events, INBOX_TODAY), details: DETAILS[key] };
}

function allStrings(action: Action): string[] {
  const { sheet } = action;
  return [action.label, sheet.title, sheet.draft ?? "", sheet.confirm, sheet.note, ...(sheet.slots ?? []), ...(sheet.prep ?? [])];
}

const SAM_FOUR = [
  "decideOffer:Wrenfield:Founding Engineer",
  "pickTime:Lumora Health:-",
  "confirmInterview:Cindermoor Cloud:Software Engineer, New Grad",
  "decideOffer:Quillbright:Software Engineer, Product",
];

describe("needsYou", () => {
  // Catches: the board and the brief disagreeing about what comes first for Sam.
  it("gives Sam exactly four, the soonest due offer first", () => {
    const { pipeline, details } = inboxOf("sam");
    const four = needsYou(pipeline, details, INBOX_TODAY);
    expect(four).toHaveLength(4);
    expect(four[0].kind).toBe("decideOffer");
    expect(four[0].company).toBe("Wrenfield");
    const dues = four.map((action) => action.due);
    expect(dues).toEqual([...dues].sort());
    expect(four.map((action) => action.id)).toEqual(SAM_FOUR);
  });

  // Catches: Task 5's "a founder replied to your intro" line getting a different id from the board's pickTime action.
  it("includes pickTime:Lumora Health with the id the brief line builds", () => {
    const { pipeline, details } = inboxOf("sam");
    const lumora = needsYou(pipeline, details, INBOX_TODAY).find((action) => action.kind === "pickTime");
    expect(lumora?.id).toBe("pickTime:Lumora Health:-");
    expect(lumora?.role).toBeNull();
    expect(lumora?.who?.name).toBe("Aaron Sulbaran");
  });

  // Catches: a sheet whose confirm button has no words, or an em dash in any draft.
  it("gives every action a confirm, a hand-off note and no em dash", () => {
    const { pipeline, details } = inboxOf("sam");
    for (const action of needsYou(pipeline, details, INBOX_TODAY)) {
      expect(action.sheet.confirm.length).toBeGreaterThan(0);
      expect(action.sheet.note).toContain("This demo sends nothing");
      for (const text of allStrings(action)) expect(text).not.toContain("\u2014");
    }
  });

  // Catches: a person with no pinned details losing their stage-based labels or their quiet days.
  it("labels a generic person's rows from the stage map, with no contact and the quiet days", () => {
    const { pipeline, details } = inboxOf("ravi");
    const list = needsYou(pipeline, details, INBOX_TODAY);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(4);
    for (const action of list) {
      expect(action.who).toBeNull();
      expect(action.due).toBeNull();
      expect(typeof action.quietDays).toBe("number");
      expect(action.label).toBe(copy.labels[action.kind](action.company));
    }
    expect(list[0].kind).toBe("decideOffer");
  });

  it("returns the same ids on two calls", () => {
    const { pipeline, details } = inboxOf("sam");
    const first = needsYou(pipeline, details, INBOX_TODAY).map((action) => action.id);
    expect(needsYou(pipeline, details, INBOX_TODAY).map((action) => action.id)).toEqual(first);
  });

  it("hands back nothing for an empty pipeline", () => {
    expect(needsYou({ rows: [], stats: { applied: 0, inProcess: 0, intros: 0, offers: 0 } }, undefined, INBOX_TODAY)).toEqual([]);
  });
});

describe("rowAction", () => {
  const row = (over: Partial<AppRow>): AppRow => ({
    company: "Vantablue", role: "Full Stack Engineer", lane: "jobs", furthest: "screen", exit: "open",
    lastEventAt: "2026-10-29T10:00:00.000Z", next: null, ...over,
  });

  // Catches: the quiet-application window drifting from 7 days, or following up on a row with nobody to nudge.
  it("follows up on a screen quiet for 9 days when a contact is known, and not before 7", () => {
    const details = DETAILS.sam;
    const quiet = rowAction(row({}), details, INBOX_TODAY);
    expect(quiet?.kind).toBe("followUp");
    expect(quiet?.quietDays).toBe(9);
    expect(rowAction(row({ lastEventAt: "2026-11-01T10:00:00.000Z" }), details, INBOX_TODAY)?.kind).toBe("replyTimes");
    expect(rowAction(row({}), undefined, INBOX_TODAY)?.kind).toBe("replyTimes");
  });

  it("skips rows that are closed", () => {
    expect(rowAction(row({ exit: "rejected" }), DETAILS.sam, INBOX_TODAY)).toBeNull();
    expect(rowAction(row({ furthest: "applied" }), undefined, INBOX_TODAY)).toBeNull();
  });
});

describe("todayActions", () => {
  // Catches: Today's list naming a different action than the board for the same overnight email.
  it("turns Sam's overnight emails into the same ids the board uses", () => {
    const { events, details } = inboxOf("sam");
    const ids = todayActions(events, details, INBOX_TODAY).map((action) => action.id);
    expect(ids).toEqual([
      "pickTime:Lumora Health:-",
      "replyTimes:Tarnmoor Robotics:Founding Engineer",
      "confirmInterview:Cindermoor Cloud:Software Engineer, New Grad",
    ]);
  });
});

describe("introCards", () => {
  const match: Match = {
    company: { name: "Halden Labs", slug: "halden", logo: null, cohort: null, stage: null, blurb: "A blurb" },
    role: null, score: 1, reasons: [], connect: ["intro"],
  };
  const intake: Intake = { targets: ["product"], places: [], why: "I want a small team." };
  const candidate = { firstName: "Alex", headline: "PM", shipped: ["a thing"], kind: "visitor" as const };

  // Catches: the live request sinking below the seeded intros.
  it("puts the live request first with status requested", () => {
    const { events, details } = inboxOf("sam");
    const request = createRequest({ candidate, shortlist: [match], intake });
    const cards = introCards(events, request, details, INBOX_TODAY);
    expect(cards[0]).toMatchObject({ company: "Halden Labs", status: "requested", action: null });
    expect(cards.slice(1).map((card) => card.company)).toContain("Lumora Health");
  });

  it("reads each founder's state from the details and quiet days", () => {
    const { events, details } = inboxOf("sam");
    const byCompany = Object.fromEntries(introCards(events, null, details, INBOX_TODAY).map((card) => [card.company, card]));
    expect(byCompany["Lumora Health"]).toMatchObject({ status: "replied", action: { kind: "pickTime" } });
    expect(byCompany["min/Max"]).toMatchObject({ status: "scheduled", action: { kind: "prepare" } });
    expect(byCompany["min/Max"].action?.sheet.prep?.length).toBeGreaterThan(0);
    expect(byCompany["Velmora Loft"]).toMatchObject({ status: "waiting", action: { kind: "followUp" } });
    expect(byCompany["Velmora Loft"].who.name).toBe("Aaron Sulbaran");
    expect(introCards(events, null, details, INBOX_TODAY).filter((card) => card.company === "Lumora Health")).toHaveLength(1);
  });

  // Catches: Task 6b's pinned phrase drifting, or the made-up meeting link turning into a real href.
  it("joins the meeting on the day, says where the real version opens, and keeps the link out of links", () => {
    const { events, details } = inboxOf("sam");
    const card = introCards(events, null, details, "2026-11-10").find((entry) => entry.company === "min/Max");
    expect(card?.action?.kind).toBe("joinMeeting");
    expect(card?.action?.sheet.note).toContain("the real version opens Meet or Zoom");
    for (const link of card?.action?.sheet.links ?? []) expect(link.href).not.toContain("meet.example");
  });

  it("only links real addresses", () => {
    const { pipeline, details } = inboxOf("sam");
    for (const action of needsYou(pipeline, details, INBOX_TODAY)) {
      for (const link of action.sheet.links ?? []) expect(link.href).toMatch(/^https:\/\/www\.linkedin\.com\/in\/aaron-sulbaran\/?$/);
    }
  });
});
