import { siteContent, speedrunCopy } from "@/lib/content";
import type { BriefItem } from "./brief";
import { cleanUrl } from "./cleanUrl";
import type { CompanyDetail, Contact } from "./details";
import type { IntroRequest } from "./introRequest";
import { daysFrom, detailFor, introStatusOf, QUIET_INTRO_DAYS } from "./intros";
import { rowKey } from "./keys";
import { STAGES } from "./pipeline";
import { getSnapshot } from "./snapshot";
import { clockLabel, dayLabel, whenLabel } from "./when";
import type { AppRow, InboxEvent, Lane, Pipeline, Stage } from "./types";

export type ActionKind =
  | "decideOffer"
  | "pickTime"
  | "replyTimes"
  | "confirmInterview"
  | "prepare"
  | "finishAssessment"
  | "finishApplication"
  | "followUp"
  | "joinMeeting"
  | "addToCalendar"
  | "bringForward"
  | "apply";

export type SheetContent = {
  title: string;
  draft?: string;
  slots?: string[];
  prep?: string[];
  /** Shown as plain text; never an href. `when` is `whenLabel(at)`, the format the slots use. */
  meeting?: { at: string; link: string; when: string };
  /** Each slot is its own confirm: tapping one sends that time, and there is no send-all button. */
  pickSlot?: boolean;
  links?: { label: string; href: string }[];
  /** Plain words under the title, for a sheet that drafts nothing. */
  summary?: string;
  /** Absent on a Pick a time sheet: each slot confirms itself. */
  confirm?: string;
  /** What the confirmed line says, plainly. */
  done: string;
  note: string;
};

export type Action = {
  /**
   * `${kind}:${company}:${role ?? "-"}`, so the board, Today, intros and the brief all name one action the same way.
   * Bring forward has no role title, so its third part is the match key instead.
   */
  id: string;
  kind: ActionKind;
  company: string;
  role: string | null;
  /** A fund or an accelerator has a round, not a role, so its actions read without the role. */
  lane: Lane;
  who: Contact | null;
  due: string | null;
  quietDays: number | null;
  label: string;
  sheet: SheetContent;
  /** The match this action brings forward; confirming it also adds it to the shortlist. */
  matchKey?: string;
};

export type IntroCard = {
  company: string;
  who: Contact;
  status: "requested" | "withFounder" | "connected" | "replied" | "scheduled" | "waiting";
  action: Action | null;
  /** The booked call, for Join. */
  call: Action | null;
  /** The same call as Add to calendar, an action of its own that never settles the card. */
  calendar: Action | null;
};

type Details = Record<string, CompanyDetail> | undefined;
type SheetCopy = {
  title: (company: string, role: string | null) => string;
  draft?: (company: string, role: string | null) => string;
  /** Replaces the draft for a fund or an accelerator, where even the role-less draft reads wrong. */
  founderDraft?: () => string;
  summary?: (company: string, role: string | null) => string;
  confirm?: string;
  done: string;
  note: string;
};

const copy = speedrunCopy.actions;
const sheetCopy: Record<ActionKind, SheetCopy> = copy.sheets;
const DAY_MS = 86_400_000;
const MAX_NEEDS = 4;
const QUIET_APPLICATION_DAYS = 7;
/** "This week" is the next six days after today. */
const WEEK_DAYS = 6;
// Minutes after midnight, so a slot is worded by the same `clockLabel` as a booked call.
const SLOT_MINUTES = [10 * 60, 14 * 60 + 30, 11 * 60];
// Quiet rows rank last, after a screen.
const STAGE_RANK: Record<Stage, number> = { offer: 0, interview: 1, assessment: 2, screen: 3, applied: 4 };
const QUIET_RANK = 4;
const LINKEDIN = siteContent.menu.socials.find((social) => social.key === "linkedin")?.href;

const LANE_ROLE_FREE: Lane = "founder";
const snapshotPosting = (company: string, role: string | null) => (role ? (getSnapshot().roles.find((entry) => entry.company === company && entry.title === role)?.url ?? null) : null);
const dayOf = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const daysUntil = (iso: string, today: string) => dayOf(iso) - dayOf(today);
const httpsOnly = (href: string | null | undefined) => (href && /^https:\/\//i.test(href) ? href : null);
const idOf = (kind: ActionKind, company: string, role: string | null) => `${kind}:${company}:${role ?? "-"}`;
const defaultContact = (company: string): Contact => ({ name: "Aaron Sulbaran", title: copy.founderTitle(company) });

/** The next three weekdays after today, one time each, so a reply always has real choices. */
export function slotsFor(today: string): string[] {
  const slots: string[] = [];
  for (let offset = 1; slots.length < SLOT_MINUTES.length; offset += 1) {
    const date = new Date((dayOf(today) + offset) * DAY_MS);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    slots.push(`${dayLabel(date)}, ${clockLabel(new Date(date.getTime() + SLOT_MINUTES[slots.length] * 60_000))}`);
  }
  return slots;
}

type Extras = { posting?: string | null; matchKey?: string; id?: string; lane?: Lane };

function sheetFor(kind: ActionKind, company: string, role: string | null, who: Contact | null, detail: CompanyDetail | undefined, today: string, postingUrl?: string | null, lane: Lane = "jobs"): SheetContent {
  const text = sheetCopy[kind];
  // A fund's row names a round ("Seed intro"), not a job, so its sheet uses the role-less words.
  const fund = lane === LANE_ROLE_FREE;
  const named = fund ? null : role;
  const sheet: SheetContent = { title: text.title(company, named), done: text.done, note: text.note };
  if (text.confirm) sheet.confirm = text.confirm;
  if (text.draft) sheet.draft = fund && text.founderDraft ? text.founderDraft() : text.draft(company, named);
  if (text.summary) sheet.summary = text.summary(company, named);
  if (kind === "pickTime" || kind === "replyTimes") sheet.slots = slotsFor(today);
  // Prep notes belong to someone with a pinned detail; a generic row gets none. The interview line is a confirmation plus prep.
  const preps = kind === "prepare" || kind === "joinMeeting" || kind === "confirmInterview";
  // A prepare sheet always has its points: the pinned ones, or the general ones that name no meeting, link or company fact.
  if (preps && detail) sheet.prep = detail.prep ?? copy.defaultPrep;
  else if (kind === "prepare") sheet.prep = copy.defaultPrep;
  if (detail?.meeting) sheet.meeting = { ...detail.meeting, when: whenLabel(detail.meeting.at) };
  if (kind === "pickTime") sheet.pickSlot = true;
  const links: { label: string; href: string }[] = [];
  if (who && LINKEDIN) links.push({ label: copy.linkedin(who.name), href: LINKEDIN });
  const site = preps ? httpsOnly(detail?.site) : null;
  if (site) links.push({ label: copy.siteLink(company), href: site });
  const posting = httpsOnly(postingUrl ? cleanUrl(postingUrl) : null);
  if (posting) links.push({ label: copy.postingLink, href: posting });
  if (links.length > 0) sheet.links = links;
  return sheet;
}

function build(kind: ActionKind, company: string, role: string | null, detail: CompanyDetail | undefined, quietDays: number, today: string, who = detail?.contact ?? null, extras: Extras = {}): Action {
  const meetingDue = kind === "prepare" || kind === "joinMeeting" ? detail?.meeting?.at : undefined;
  const due = detail?.due ?? meetingDue ?? null;
  const action: Action = {
    id: extras.id ?? idOf(kind, company, role),
    kind,
    company,
    role,
    lane: extras.lane ?? "jobs",
    who,
    due,
    quietDays: due ? null : quietDays,
    label: copy.labels[kind](company),
    sheet: sheetFor(kind, company, role, who, detail, today, extras.posting === undefined ? snapshotPosting(company, role) : extras.posting, extras.lane),
  };
  if (extras.matchKey) action.matchKey = extras.matchKey;
  return action;
}

/** A booked call is joined on the day and prepared for in the days before it. */
function meetingKind(detail: CompanyDetail | undefined, today: string): "joinMeeting" | "prepare" | null {
  if (!detail?.meeting) return null;
  const away = daysUntil(detail.meeting.at, today);
  if (away === 0) return "joinMeeting";
  return away > 0 && away <= WEEK_DAYS ? "prepare" : null;
}

function kindForStage(stage: Stage, detail: CompanyDetail | undefined, today: string): ActionKind | null {
  switch (stage) {
    case "offer":
      return "decideOffer";
    case "interview":
      // With nobody pinned to confirm with, the interview is already on: get ready for it.
      return meetingKind(detail, today) ?? (detail ? "confirmInterview" : "prepare");
    case "assessment":
      return "finishAssessment";
    case "screen":
      return meetingKind(detail, today) ?? "replyTimes";
    default:
      return null;
  }
}

export function rowAction(row: AppRow, details: Details, today: string): Action | null {
  if (row.exit !== "open") return null;
  const detail = detailFor(details, row.company, row.role);
  const quietDays = daysFrom(row.lastEventAt, today);
  const reachedScreen = STAGES.indexOf(row.furthest) >= STAGES.indexOf("screen");
  // An offer is decided, not nudged; anything else that has gone quiet is a follow-up.
  const nudge = reachedScreen && row.furthest !== "offer" && !detail?.due && !detail?.meeting && quietDays >= QUIET_APPLICATION_DAYS;
  const kind = nudge ? "followUp" : kindForStage(row.furthest, detail, today);
  return kind ? build(kind, row.company, row.role, detail, quietDays, today, detail?.contact ?? null, { lane: row.lane }) : null;
}

type Ranked = { action: Action; rank: number; last: string };

/** By due date, soonest first; without one, by stage and then the newest news. */
function byRanking(a: Ranked, b: Ranked): number {
  if (a.action.due && b.action.due) return a.action.due.localeCompare(b.action.due) || a.rank - b.rank || b.last.localeCompare(a.last);
  if (a.action.due || b.action.due) return a.action.due ? -1 : 1;
  return a.rank - b.rank || b.last.localeCompare(a.last);
}

export function needsYou(pipeline: Pipeline, details: Details, today: string): Action[] {
  const ranked: Ranked[] = [];
  const companies = new Set(pipeline.rows.map((row) => row.company));
  for (const row of pipeline.rows) {
    const action = rowAction(row, details, today);
    if (action) ranked.push({ action, rank: action.kind === "followUp" ? QUIET_RANK : STAGE_RANK[row.furthest], last: row.lastEventAt });
  }
  // A founder who wrote back on an intro has no row of its own: its detail carries the state.
  for (const [company, detail] of Object.entries(details ?? {})) {
    if (detail.introStatus !== "replied" || detail.role || companies.has(company)) continue;
    ranked.push({ action: pickTimeAction(company, details, today), rank: STAGE_RANK.interview, last: `${today}T00:00:00.000Z` });
  }
  const seen = new Set<string>();
  return ranked
    .sort(byRanking)
    .filter(({ action }) => !seen.has(action.id) && seen.add(action.id))
    .slice(0, MAX_NEEDS)
    .map(({ action }) => action);
}

export type TodayItem = {
  action: Action;
  /** An interview with a booked call: Join opens this sheet. */
  join: Action | null;
  /** The same call as its own Add to calendar action; it never settles the row. */
  calendar: Action | null;
};

/** The call an action points at: the same company and role, as a joinMeeting with the call's time and mock link. */
export function callFor(action: Action, details: Details, today: string): Action | null {
  if (action.kind === "joinMeeting") return action;
  if (action.kind !== "confirmInterview" && action.kind !== "prepare") return null;
  const detail = detailFor(details, action.company, action.role);
  return detail?.meeting ? build("joinMeeting", action.company, action.role, detail, 0, today, action.who) : null;
}

/** Add to calendar for a booked call: its own action and id, so adding it never marks the call joined. */
export function calendarFor(call: Action | null, details: Details, today: string): Action | null {
  if (!call) return null;
  return build("addToCalendar", call.company, call.role, detailFor(details, call.company, call.role), 0, today, null);
}

/** Today's actions. An interview with a booked call also carries that call: confirm first, then join. */
export function todayItems(events: InboxEvent[], details: Details, today: string): TodayItem[] {
  return todayActions(events, details, today).map((action) => {
    const join = action.kind === "prepare" ? null : callFor(action, details, today);
    return { action, join, calendar: calendarFor(join, details, today) };
  });
}

const todayKind: Partial<Record<InboxEvent["kind"], Stage>> = { assessment: "assessment", screen: "screen", interview: "interview", offer: "offer" };

export function todayActions(events: InboxEvent[], details: Details, today: string): Action[] {
  const seen = new Set<string>();
  const out: Action[] = [];
  const newestFirst = events.filter((event) => event.date.startsWith(today)).sort((a, b) => b.date.localeCompare(a.date));
  for (const event of newestFirst) {
    let action: Action | null = null;
    if (event.kind === "intro") {
      action = introActionFor(event, details, today);
    } else {
      const stage = todayKind[event.kind];
      const detail = detailFor(details, event.company, event.role);
      const kind = stage ? kindForStage(stage, detail, today) : null;
      if (kind) action = build(kind, event.company, event.role, detail, 0, today, detail?.contact ?? null, { lane: event.lane });
    }
    if (!action || seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(action);
  }
  return out;
}

function introAction(company: string, detail: CompanyDetail | undefined, status: IntroCard["status"], quietDays: number, today: string, who: Contact): Action | null {
  if (status === "replied") return build("pickTime", company, null, detail, quietDays, today, who);
  if (status === "scheduled") {
    const kind = meetingKind(detail, today);
    return kind ? build(kind, company, null, detail, quietDays, today, who) : null;
  }
  if (status === "waiting" && quietDays >= QUIET_INTRO_DAYS) return build("followUp", company, null, detail, quietDays, today, who);
  return null;
}

/** Today and the intro cards read an intro the same way, so one company never has two different actions. */
function introActionFor(event: InboxEvent, details: Details, today: string): Action | null {
  return introActionAt(event.company, event.date, details, today);
}

/** The brief's intro line carries the intro's date, so it reads the same status and quiet days as Today and the cards. */
function introActionAt(company: string, date: string, details: Details, today: string): Action | null {
  const detail = detailFor(details, company, null);
  const who = detail?.contact ?? defaultContact(company);
  return introAction(company, detail, introStatusOf(detail), daysFrom(date, today), today, who);
}

export function introCards(events: InboxEvent[], request: IntroRequest | null, details: Details, today: string): IntroCard[] {
  const cards: IntroCard[] = [];
  if (request && request.status !== "passed") {
    const company = request.match.company.name;
    cards.push({ company, who: detailFor(details, company, null)?.contact ?? defaultContact(company), status: request.status, action: null, call: null, calendar: null });
  }
  const latest = new Map<string, InboxEvent>();
  for (const event of events) {
    if (event.kind !== "intro") continue;
    const seen = latest.get(event.company);
    if (!seen || event.date > seen.date) latest.set(event.company, event);
  }
  const taken = new Set(cards.map((card) => card.company));
  for (const event of [...latest.values()].sort((a, b) => b.date.localeCompare(a.date))) {
    if (taken.has(event.company)) continue;
    const detail = detailFor(details, event.company, null);
    const status = introStatusOf(detail);
    const who = detail?.contact ?? defaultContact(event.company);
    const action = introAction(event.company, detail, status, daysFrom(event.date, today), today, who);
    const call = action ? callFor(action, details, today) : null;
    cards.push({ company: event.company, who, status, action, call, calendar: calendarFor(call, details, today) });
  }
  return cards;
}

/** The action that settles an intro card: its own, or the call it points at. Cards and the Intros tile's rows both read this, so they settle together. */
export function settledAction(card: IntroCard, isDone: (action: Action) => boolean): Action | null {
  if (card.action && isDone(card.action)) return card.action;
  return card.call && isDone(card.call) ? card.call : null;
}

/** A founder who wrote back on an intro: the one pickTime the board and the brief both build. */
function pickTimeAction(company: string, details: Details, today: string): Action {
  const detail = detailFor(details, company, null);
  return build("pickTime", company, null, detail, 0, today, detail?.contact ?? defaultContact(company));
}

/** A new role that fits: Bring forward adds its match to the shortlist. It has no role title, so the id's last part is the match key. */
function bringForwardAction(company: string, matchKey: string, posting: string | null, today: string): Action {
  return build("bringForward", company, null, undefined, 0, today, null, { matchKey, posting, id: idOf("bringForward", company, matchKey) });
}

/**
 * The one action a brief line opens, from what the line is about (its kind, company and key) and the pipeline,
 * never from its words. A reply or a due line reads its row, so it has the very id the board gives that row.
 * A pass, or a line with no identity, has none. A new role's second choice, Apply, is the posting link itself.
 */
export function briefAction(item: BriefItem, pipeline: Pipeline, details: Details, today: string): Action | null {
  if (!item.company) return null;
  if (item.kind === "intro") return introActionAt(item.company, item.actionKey ?? today, details, today);
  if (item.kind === "new-role") return item.actionKey ? bringForwardAction(item.company, item.actionKey, item.href, today) : null;
  const row = pipeline.rows.find((entry) => entry.company === item.company && rowKey(entry) === item.actionKey);
  return row ? rowAction(row, details, today) : null;
}

type Shown = { needs: Action[]; today: TodayItem[]; intros: IntroCard[] };

/**
 * What is still open in Today and Warm intros, once each. A Today row is open until its call is joined (a confirmation
 * comes first); an intro card is open until its own action or its call is settled. Needs you is not in this list.
 */
export function openBelow({ today, intros }: Pick<Shown, "today" | "intros">, isDone: (action: Action) => boolean): Action[] {
  const open: Action[] = [];
  for (const { action, join } of today) {
    if (isDone(join ?? action)) continue;
    open.push(action.kind === "confirmInterview" && !isDone(action) ? action : (join ?? action));
  }
  for (const card of intros) if (card.action && !settledAction(card, isDone)) open.push(card.action);
  const seen = new Set<string>();
  return open.filter((action) => !seen.has(action.id) && seen.add(action.id));
}

/** The heading's state: things need you, nothing urgent but more is open below, or all clear. */
export function boardHeadline(shown: Shown, isDone: (action: Action) => boolean): { kind: "count"; open: number } | { kind: "urgentDone"; more: number } | { kind: "clear" } {
  const open = shown.needs.filter((action) => !isDone(action)).length;
  if (open > 0) return { kind: "count", open };
  const needsIds = new Set(shown.needs.map((action) => action.id));
  const more = openBelow(shown, isDone).filter((action) => !needsIds.has(action.id)).length;
  return more > 0 ? { kind: "urgentDone", more } : { kind: "clear" };
}
