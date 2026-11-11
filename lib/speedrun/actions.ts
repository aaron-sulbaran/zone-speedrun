import { siteContent, speedrunCopy } from "@/lib/content";
import type { CompanyDetail, Contact } from "./details";
import type { IntroRequest } from "./introRequest";
import { STAGES } from "./pipeline";
import type { AppRow, InboxEvent, Pipeline, Stage } from "./types";

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
  | "bringForward"
  | "apply";

export type SheetContent = {
  title: string;
  draft?: string;
  slots?: string[];
  prep?: string[];
  links?: { label: string; href: string }[];
  confirm: string;
  note: string;
};

export type Action = {
  /** `${kind}:${company}:${role ?? "-"}`, so the board, Today, intros and the brief all name one action the same way. */
  id: string;
  kind: ActionKind;
  company: string;
  role: string | null;
  who: Contact | null;
  due: string | null;
  quietDays: number | null;
  label: string;
  sheet: SheetContent;
};

export type IntroCard = {
  company: string;
  who: Contact;
  status: "requested" | "withFounder" | "connected" | "replied" | "scheduled" | "waiting";
  action: Action | null;
};

type Details = Record<string, CompanyDetail> | undefined;
type SheetCopy = {
  title: (company: string, role: string | null) => string;
  draft?: (company: string, role: string | null) => string;
  confirm: string;
  note: string;
};

const copy = speedrunCopy.actions;
const sheetCopy: Record<ActionKind, SheetCopy> = copy.sheets;
const DAY_MS = 86_400_000;
const MAX_NEEDS = 4;
const QUIET_APPLICATION_DAYS = 7;
const QUIET_INTRO_DAYS = 5;
/** "This week" is the next six days after today. */
const WEEK_DAYS = 6;
const SLOT_TIMES = ["10:00 am", "2:30 pm", "11:00 am"];
// Quiet rows rank last, after a screen.
const STAGE_RANK: Record<Stage, number> = { offer: 0, interview: 1, assessment: 2, screen: 3, applied: 4 };
const QUIET_RANK = 4;
const LINKEDIN = siteContent.menu.socials.find((social) => social.key === "linkedin")?.href;

const dayOf = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const daysFrom = (iso: string, today: string) => Math.max(0, dayOf(today) - dayOf(iso));
const daysUntil = (iso: string, today: string) => dayOf(iso) - dayOf(today);
const idOf = (kind: ActionKind, company: string, role: string | null) => `${kind}:${company}:${role ?? "-"}`;
const defaultContact = (company: string): Contact => ({ name: "Aaron Sulbaran", title: copy.founderTitle(company) });

const SLOT_DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** The next three weekdays after today, one time each, so a reply always has real choices. */
function slotsFor(today: string): string[] {
  const slots: string[] = [];
  for (let offset = 1; slots.length < SLOT_TIMES.length; offset += 1) {
    const date = new Date((dayOf(today) + offset) * DAY_MS);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    slots.push(`${SLOT_DAY.format(date)}, ${SLOT_TIMES[slots.length]}`);
  }
  return slots;
}

function sheetFor(kind: ActionKind, company: string, role: string | null, who: Contact | null, detail: CompanyDetail | undefined, today: string): SheetContent {
  const text = sheetCopy[kind];
  const sheet: SheetContent = { title: text.title(company, role), confirm: text.confirm, note: text.note };
  if (text.draft) sheet.draft = text.draft(company, role);
  if (kind === "pickTime" || kind === "replyTimes") sheet.slots = slotsFor(today);
  if (kind === "prepare" || kind === "joinMeeting") sheet.prep = detail?.prep ?? copy.defaultPrep;
  if (who && LINKEDIN) sheet.links = [{ label: copy.linkedin(who.name), href: LINKEDIN }];
  return sheet;
}

function build(kind: ActionKind, company: string, role: string | null, detail: CompanyDetail | undefined, quietDays: number, today: string, who = detail?.contact ?? null): Action {
  const due = detail?.due ?? null;
  return {
    id: idOf(kind, company, role),
    kind,
    company,
    role,
    who,
    due,
    quietDays: due ? null : quietDays,
    label: copy.labels[kind](company),
    sheet: sheetFor(kind, company, role, who, detail, today),
  };
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
      return meetingKind(detail, today) ?? "confirmInterview";
    case "assessment":
      return "finishAssessment";
    case "screen":
      return meetingKind(detail, today) ?? "replyTimes";
    default:
      return detail?.due ? "finishApplication" : null;
  }
}

export function rowAction(row: AppRow, details: Details, today: string): Action | null {
  if (row.exit !== "open") return null;
  const detail = details?.[row.company];
  const quietDays = daysFrom(row.lastEventAt, today);
  const reachedScreen = STAGES.indexOf(row.furthest) >= STAGES.indexOf("screen");
  // Someone to nudge is what makes it a follow-up; without one the stage decides.
  const nudge = detail && reachedScreen && !detail.due && !detail.meeting && quietDays >= QUIET_APPLICATION_DAYS;
  const kind = nudge ? "followUp" : kindForStage(row.furthest, detail, today);
  return kind ? build(kind, row.company, row.role, detail, quietDays, today) : null;
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
    if (detail.introStatus !== "replied" || companies.has(company)) continue;
    ranked.push({ action: build("pickTime", company, null, detail, 0, today), rank: STAGE_RANK.interview, last: `${today}T00:00:00.000Z` });
  }
  const seen = new Set<string>();
  return ranked
    .sort(byRanking)
    .filter(({ action }) => !seen.has(action.id) && seen.add(action.id))
    .slice(0, MAX_NEEDS)
    .map(({ action }) => action);
}

const todayKind: Partial<Record<InboxEvent["kind"], Stage>> = { assessment: "assessment", screen: "screen", interview: "interview", offer: "offer" };

export function todayActions(events: InboxEvent[], details: Details, today: string): Action[] {
  const seen = new Set<string>();
  const out: Action[] = [];
  const newestFirst = events.filter((event) => event.date.startsWith(today)).sort((a, b) => b.date.localeCompare(a.date));
  for (const event of newestFirst) {
    const detail = details?.[event.company];
    const stage = todayKind[event.kind];
    const kind = event.kind === "intro" ? "pickTime" : stage ? kindForStage(stage, detail, today) : null;
    if (!kind) continue;
    const action = build(kind, event.company, event.kind === "intro" ? null : event.role, detail, 0, today);
    if (seen.has(action.id)) continue;
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

export function introCards(events: InboxEvent[], request: IntroRequest | null, details: Details, today: string): IntroCard[] {
  const cards: IntroCard[] = [];
  if (request && request.status !== "passed") {
    const company = request.match.company.name;
    cards.push({ company, who: details?.[company]?.contact ?? defaultContact(company), status: request.status, action: null });
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
    const detail = details?.[event.company];
    const status = detail?.introStatus === "replied" || detail?.introStatus === "scheduled" ? detail.introStatus : "waiting";
    const who = detail?.contact ?? defaultContact(event.company);
    cards.push({ company: event.company, who, status, action: introAction(event.company, detail, status, daysFrom(event.date, today), today, who) });
  }
  return cards;
}
