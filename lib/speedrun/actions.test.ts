import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import { briefAction, introCards, needsYou, rowAction, settledAction, todayActions, todayItems, type Action } from "./actions";
import type { BriefItem } from "./brief";
import { sampleBrief } from "./briefSample";
import type { CompanyDetail } from "./details";
import { classifyEmail } from "./classify";
import { DETAILS } from "./details";
import { INBOX_TODAY, generateInbox } from "./inbox";
import { createRequest } from "./introRequest";
import type { Match } from "./match";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";
import { buildPipeline } from "./pipeline";
import type { AppRow, Intake, PersonKey } from "./types";

const copy = speedrunCopy.actions;

function inboxOf(key: PersonKey) {
  const events = generateInbox(PEOPLE[key]).map(classifyEmail);
  return { events, pipeline: buildPipeline(events, INBOX_TODAY), details: DETAILS[key] };
}

function allStrings(action: Action): string[] {
  const { sheet } = action;
  return [action.label, sheet.title, sheet.draft ?? "", sheet.confirm ?? "", sheet.note, ...(sheet.slots ?? []), ...(sheet.prep ?? [])];
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
      // Pick a time confirms by its slots, so it has no button of its own.
      if (action.sheet.pickSlot) expect(action.sheet.confirm).toBeUndefined();
      else expect(action.sheet.confirm?.length).toBeGreaterThan(0);
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
    expect(needsYou({ rows: [], stats: { applied: 0, inProcess: 0, offers: 0 } }, undefined, INBOX_TODAY)).toEqual([]);
  });
});

describe("rowAction", () => {
  const row = (over: Partial<AppRow>): AppRow => ({
    company: "Vantablue", role: "Full Stack Engineer", lane: "jobs", furthest: "screen", exit: "open",
    appliedAt: null, lastEventAt: "2026-10-29T10:00:00.000Z", next: null, ...over,
  });

  // Catches: the quiet-application window drifting from 7 days, or following up on a row with nobody to nudge.
  it("follows up on a screen quiet for 9 days when a contact is known, and not before 7", () => {
    const details = DETAILS.sam;
    const quiet = rowAction(row({}), details, INBOX_TODAY);
    expect(quiet?.kind).toBe("followUp");
    expect(quiet?.quietDays).toBe(9);
    expect(rowAction(row({ lastEventAt: "2026-11-01T10:00:00.000Z" }), details, INBOX_TODAY)?.kind).toBe("replyTimes");
  });

  // Catches: Ruling 66 applying only to people with a pinned detail, so a generic screen quiet for weeks never gets a follow-up.
  it("follows up on a generic screen quiet for 9 days, and has no contact or prep for it", () => {
    const action = rowAction(row({}), undefined, INBOX_TODAY);
    expect(action).toMatchObject({ kind: "followUp", who: null, quietDays: 9 });
    expect(action?.sheet.prep).toBeUndefined();
  });

  // Catches: a generic interview reading "Confirm your interview" weeks after the invite, or carrying an invented meeting, link or company detail.
  it("prepares for a recent generic interview and quiet ones are followed up, never offers", () => {
    const fresh = rowAction(row({ furthest: "interview", lastEventAt: "2026-11-05T10:00:00.000Z" }), undefined, INBOX_TODAY);
    expect(fresh?.kind).toBe("prepare");
    expect(fresh?.sheet.prep).toEqual(copy.defaultPrep);
    expect(fresh?.sheet.meeting).toBeUndefined();
    expect(fresh?.sheet.links).toBeUndefined();
    expect(rowAction(row({ furthest: "interview" }), undefined, INBOX_TODAY)?.kind).toBe("followUp");
    expect(rowAction(row({ furthest: "offer" }), undefined, INBOX_TODAY)?.kind).toBe("decideOffer");
  });

  // Catches: Today's drop-down and the Prepare sheet reading two different sources of prep, so one is nearly empty (C1).
  it("gives a generic prepare sheet the three general points, and a pinned one its own", () => {
    const bare = rowAction(row({ furthest: "interview", lastEventAt: "2026-11-05T10:00:00.000Z" }), undefined, INBOX_TODAY);
    expect(bare?.sheet.prep).toHaveLength(3);
    expect(bare?.sheet.note).toContain("This demo sends nothing");
    const { events, details } = inboxOf("sam");
    const pinned = introCards(events, null, details, INBOX_TODAY).find((card) => card.company === "min/Max")?.action;
    // Catches: the general points replacing a pinned person's own prep.
    expect(pinned?.sheet.prep).toEqual(DETAILS.sam?.["min/Max"].prep);
  });

  // Catches: a snapshot role's posting URL never reaching a prep item's links (Ruling 51).
  it("links a prepare item to the role's snapshot posting", () => {
    const role = getSnapshot().roles[0];
    const event = { emailId: "t-1", company: role.company, role: role.title, kind: "interview" as const, date: `${INBOX_TODAY}T09:00:00.000Z`, lane: "jobs" as const };
    const [item] = todayItems([event], undefined, INBOX_TODAY);
    expect(item.action.kind).toBe("prepare");
    expect(item.action.sheet.links).toEqual([{ label: copy.postingLink, href: role.url }]);
  });

  // Catches: a company-keyed detail leaking onto Sam's other roles at the same company.
  it("applies a detail only to its own role", () => {
    const co = rowAction(row({ company: "Quillbright", role: "Software Engineer, Co-op", furthest: "applied" }), DETAILS.sam, INBOX_TODAY);
    expect(co).toBeNull();
    const coScreen = rowAction(row({ company: "Quillbright", role: "Software Engineer, Co-op", lastEventAt: "2026-11-06T10:00:00.000Z" }), DETAILS.sam, INBOX_TODAY);
    expect(coScreen?.due).toBeNull();
    expect(coScreen?.who).toBeNull();
    const offer = rowAction(row({ company: "Quillbright", role: "Software Engineer, Product", furthest: "offer" }), DETAILS.sam, INBOX_TODAY);
    expect(offer).toMatchObject({ kind: "decideOffer", due: "2026-11-10" });
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

describe("settledAction", () => {
  const { events, details } = inboxOf("sam");
  const card = introCards(events, null, details, INBOX_TODAY).find((entry) => entry.company === "min/Max") as NonNullable<ReturnType<typeof introCards>[number]>;
  const done = (...ids: (string | undefined)[]) => (action: Action) => ids.includes(action.id);

  it("is the action once it is done, the call once the call is, and nothing before", () => {
    // Catches: fixture drift that leaves min/Max with no call, such as its intro status turning to replied (a pickTime card): the joined-call check below would compare undefined to undefined.
    expect(card.call).not.toBeNull();
    // Catches: a card that reads as settled before anything is done.
    expect(settledAction(card, done())).toBeNull();
    // Catches: the card's own action being done not settling it.
    expect(settledAction(card, done(card.action?.id))?.id).toBe(card.action?.id);
    // Catches: a joined call not settling the card and the Intros tile row with it (Ruling 58).
    expect(settledAction(card, done(card.call?.id))?.id).toBe(card.call?.id);
  });
});

describe("todayItems", () => {
  // Catches: Today's interview having no call to join, so Join and Add to calendar have nothing to open (Ruling 51).
  it("pairs Sam's Cindermoor interview with a joinMeeting sheet that carries the mock link and the Meet or Zoom note", () => {
    const { events, details } = inboxOf("sam");
    const items = todayItems(events, details, INBOX_TODAY);
    expect(items.map((item) => item.action.id)).toEqual(todayActions(events, details, INBOX_TODAY).map((action) => action.id));
    const cinder = items.find((item) => item.action.company === "Cindermoor Cloud");
    expect(cinder?.join?.kind).toBe("joinMeeting");
    expect(cinder?.join?.sheet.meeting?.link).toBe("https://meet.example/cindermoor-interview");
    expect(cinder?.join?.sheet.note).toContain("the real version opens Meet or Zoom");
    // Catches: a call offered for a reply that has no booked time.
    expect(items.filter((item) => item.join).map((item) => item.action.company)).toEqual(["Cindermoor Cloud"]);
    // Catches: Today's interview carrying a different action from Needs you, so confirming in one leaves the other open (fix 6).
    expect(cinder?.action.id).toBe("confirmInterview:Cindermoor Cloud:Software Engineer, New Grad");
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
    // Catches: Add to calendar opening the Prepare sheet instead of the call's (fix 7).
    expect(byCompany["min/Max"].call?.kind).toBe("joinMeeting");
    expect(byCompany["min/Max"].call?.sheet.meeting?.link).toBe("https://meet.example/minmax-intro");
    expect(byCompany["Lumora Health"].call).toBeNull();
  });

  // Catches: Task 6b's pinned phrase drifting, or the made-up meeting link turning into a real href.
  it("joins the meeting on the day, says where the real version opens, and keeps the link out of links", () => {
    const { events, details } = inboxOf("sam");
    const card = introCards(events, null, details, "2026-11-09").find((entry) => entry.company === "min/Max");
    expect(card?.action?.kind).toBe("joinMeeting");
    expect(card?.action?.sheet.note).toContain("the real version opens Meet or Zoom");
    for (const link of card?.action?.sheet.links ?? []) expect(link.href).not.toContain("meet.example");
  });

  // Catches: the meeting time and mock link never reaching the sheet, or prepare ignoring the call's own date.
  it("carries the meeting on the sheet and dates a prepare by it", () => {
    const { pipeline, events, details } = inboxOf("sam");
    const card = introCards(events, null, details, INBOX_TODAY).find((entry) => entry.company === "min/Max");
    expect(card?.action?.sheet.meeting).toMatchObject(DETAILS.sam?.["min/Max"].meeting ?? {});
    expect(card?.action?.due).toBe("2026-11-09T15:00:00.000Z");
    const cinder = needsYou(pipeline, details, INBOX_TODAY).find((action) => action.company === "Cindermoor Cloud");
    expect(cinder?.sheet.meeting?.at).toBe("2026-11-16T15:00:00.000Z");
    expect(cinder?.due).toBe("2026-11-09");
  });

  // Catches: an intro follow-up that talks about "my application".
  it("words an intro follow-up about the introduction", () => {
    const { events, details } = inboxOf("sam");
    const velmora = introCards(events, null, details, INBOX_TODAY).find((entry) => entry.company === "Velmora Loft");
    expect(velmora?.action?.sheet.draft).toContain("introduction");
    expect(velmora?.action?.sheet.draft).not.toContain("application");
  });

  // Catches: Today reading a scheduled intro as "Pick a time" while its card says scheduled.
  it("gives an intro the same action in Today and on its card", () => {
    const { events, details } = inboxOf("sam");
    const moved = events.map((event) => (event.company === "min/Max" ? { ...event, date: "2026-11-09T09:00:00.000Z" } : event));
    const day = "2026-11-09";
    const card = introCards(moved, null, details, day).find((entry) => entry.company === "min/Max");
    const today = todayActions(moved, details, day).find((action) => action.company === "min/Max");
    expect(card?.action?.id).toBe("joinMeeting:min/Max:-");
    expect(today?.id).toBe(card?.action?.id);
    const lumora = todayActions(events, details, INBOX_TODAY).find((action) => action.company === "Lumora Health");
    expect(lumora?.id).toBe(introCards(events, null, details, INBOX_TODAY).find((entry) => entry.company === "Lumora Health")?.action?.id);
  });

  it("only links real addresses", () => {
    const { pipeline, details } = inboxOf("sam");
    for (const action of needsYou(pipeline, details, INBOX_TODAY)) {
      for (const link of action.sheet.links ?? []) expect(link.href).toMatch(/^https:\/\/www\.linkedin\.com\/in\/aaron-sulbaran\/?$/);
    }
  });
});

describe("briefAction", () => {
  const sam = () => inboxOf("sam");
  const item = (patch: Partial<BriefItem>): BriefItem => ({ kind: "reply", text: "x", href: null, company: null, actionKey: null, ...patch });

  // Catches: a brief line whose button opens a different action from the board's, so "done" in one never shows in the other.
  it("gives Sam's brief lines the very ids the board and Today use", () => {
    const { pipeline, details } = sam();
    const ids = sampleBrief("sam").items.map((line) => briefAction(line, pipeline, details, INBOX_TODAY)?.id);
    expect(ids).toEqual(["pickTime:Lumora Health:-", "replyTimes:Tarnmoor Robotics:Founding Engineer", "confirmInterview:Cindermoor Cloud:Software Engineer, New Grad"]);
    const board = needsYou(pipeline, details, INBOX_TODAY).map((action) => action.id);
    expect(board).toContain(ids[0]);
    expect(board).toContain(ids[2]);
  });

  // Catches: an action read off the line's words, which a rewritten line would break.
  it("reads the row, never the text", () => {
    const { pipeline, details } = sam();
    const line = sampleBrief("sam").items[2];
    const reworded = briefAction({ ...line, text: "Some other words entirely." }, pipeline, details, INBOX_TODAY);
    expect(reworded?.id).toBe(briefAction(line, pipeline, details, INBOX_TODAY)?.id);
    expect(reworded?.kind).toBe("confirmInterview");
  });

  // Catches: a pass or a pastless line getting a button that does nothing.
  it("has no action for a pass or for a line with no identity", () => {
    const { pipeline, details } = sam();
    const rejected = pipeline.rows.find((row) => row.exit === "rejected");
    expect(rejected).toBeDefined();
    const line = item({ company: rejected?.company ?? null, actionKey: `${rejected?.company}:${rejected?.role ?? "-"}` });
    expect(briefAction(line, pipeline, details, INBOX_TODAY)).toBeNull();
    expect(briefAction(item({}), pipeline, details, INBOX_TODAY)).toBeNull();
  });

  // Catches: Bring forward turning into a note to the company, or losing the match it adds.
  it("turns a new-role line into Bring forward with the match key, a shortlist sheet and the real posting", () => {
    const line = item({ kind: "new-role", company: "Quillmark", actionKey: "Quillmark-r1", href: "https://example.com/r" });
    const action = briefAction(line, { rows: [], stats: { applied: 0, inProcess: 0, offers: 0 } }, undefined, INBOX_TODAY);
    expect(action?.kind).toBe("bringForward");
    expect(action?.matchKey).toBe("Quillmark-r1");
    expect(action?.id).toBe("bringForward:Quillmark:Quillmark-r1");
    expect(action?.label).toBe("Bring forward");
    expect(action?.sheet.confirm).toBe("Add to my shortlist");
    expect(action?.sheet.draft).toBeUndefined();
    expect(action?.sheet.summary).toMatch(/shortlist/i);
    expect(action?.sheet.links).toEqual([{ label: copy.postingLink, href: "https://example.com/r" }]);
    expect(`${action?.label} ${action?.sheet.title} ${action?.sheet.summary}`).not.toMatch(/faster|move/i);
  });

  // Catches: the brief's intro line skipping the status logic Today and the intro cards use (a waiting intro is no "pick a time").
  it("reads an intro line's status like the intro cards do", () => {
    const { pipeline, details, events } = { ...sam(), events: inboxOf("sam").events };
    const lumora = sampleBrief("sam").items[0];
    expect(briefAction(lumora, pipeline, details, INBOX_TODAY)?.id).toBe(introCards(events, null, details, INBOX_TODAY).find((card) => card.company === "Lumora Health")?.action?.id);
    const waiting = item({ kind: "intro", company: "Nobody Yet", actionKey: `${INBOX_TODAY}T01:00:00.000Z` });
    expect(briefAction(waiting, pipeline, details, INBOX_TODAY)).toBeNull();
  });

  // Catches: Pick a time showing a send-all button, or a meeting time in a different format from the slots.
  it("lets Pick a time pick a slot, and words a booked call like a slot", () => {
    const { pipeline, details } = sam();
    const [intro, , cinder] = sampleBrief("sam").items;
    expect(briefAction(intro, pipeline, details, INBOX_TODAY)?.sheet.pickSlot).toBe(true);
    expect(briefAction(cinder, pipeline, details, INBOX_TODAY)?.sheet.meeting?.when).toBe("Mon, Nov 16, 3:00\u00a0pm");
    expect(briefAction(cinder, pipeline, details, INBOX_TODAY)?.sheet.pickSlot).toBeUndefined();
  });

  // Catches: a posting link that is not a real https address reaching a sheet.
  it("drops a posting that is not https", () => {
    const line = item({ kind: "new-role", company: "Quillmark", actionKey: "Quillmark-r1", href: "javascript:alert(1)" });
    const action = briefAction(line, { rows: [], stats: { applied: 0, inProcess: 0, offers: 0 } }, undefined, INBOX_TODAY);
    expect(action?.sheet.links ?? []).toEqual([]);
  });

  // Catches: CompanyDetail.site never read, so the prep sheet links nothing.
  it("links the company's real site on a prep sheet, and the interview carries the prep", () => {
    const { pipeline, details } = sam();
    const withSite: Record<string, CompanyDetail> = { ...details, "Cindermoor Cloud": { ...details!["Cindermoor Cloud"], site: "https://cindermoor.example.com" } };
    const line = sampleBrief("sam").items[2];
    const action = briefAction(line, pipeline, withSite, INBOX_TODAY);
    expect(action?.sheet.links).toContainEqual({ label: copy.siteLink("Cindermoor Cloud"), href: "https://cindermoor.example.com" });
    expect(action?.sheet.prep?.length).toBeGreaterThan(0);
  });

  // Catches: a send-style sheet with no word for what happened, or a bring-forward that claims it sent something.
  it("says Sent for a reply and Added for Bring forward", () => {
    const { pipeline, details } = sam();
    const [intro] = sampleBrief("sam").items;
    expect(briefAction(intro, pipeline, details, INBOX_TODAY)?.sheet.done).toBe("Sent");
    const line = item({ kind: "new-role", company: "Quillmark", actionKey: "Quillmark-r1" });
    expect(briefAction(line, pipeline, details, INBOX_TODAY)?.sheet.done).toBe("Added");
  });
});

describe("every sheet", () => {
  // Catches: a kind that loses its confirm and renders a nameless button.
  it("has a confirm, except Pick a time, which has slots to tap", () => {
    const kinds = Object.keys(speedrunCopy.actions.sheets) as (keyof typeof speedrunCopy.actions.sheets)[];
    expect(kinds.length).toBeGreaterThan(8);
    for (const kind of kinds) {
      const sheet = speedrunCopy.actions.sheets[kind] as { confirm?: string };
      if (kind === "pickTime") expect(sheet.confirm, kind).toBeUndefined();
      else expect(sheet.confirm?.trim().length, kind).toBeGreaterThan(0);
    }
    const { pipeline, details } = inboxOf("sam");
    const pick = needsYou(pipeline, details, INBOX_TODAY).find((action) => action.kind === "pickTime");
    expect(pick?.sheet.slots?.length).toBe(3);
    expect(pick?.sheet.pickSlot).toBe(true);
  });
});
