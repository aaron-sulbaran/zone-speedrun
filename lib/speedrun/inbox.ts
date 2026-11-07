import {
  FICTIONAL_COMPANIES,
  FOUNDER_ACCELERATORS,
  FOUNDER_ACCELERATOR_ROUNDS,
  FOUNDER_FUNDS,
  FOUNDER_FUND_ROUNDS,
} from "./fictional";
import type { InboxEmail, Person, PersonKey } from "./types";

/** The fixed "today" for sample inboxes, so the demo never drifts. */
export const INBOX_TODAY = "2026-11-07";
const ANCHOR_MS = new Date(`${INBOX_TODAY}T12:00:00.000Z`).getTime();
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

type Buckets = { assessment: number; screen: number; interview: number; offer: number };
type Plan = { live?: boolean; founderRows: number; jobs: Buckets; founder: Buckets; intros: number; roles: string[] };

const ZERO: Buckets = { assessment: 0, screen: 0, interview: 0, offer: 0 };
const ENGINEERING_ROLES = [
  "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "Platform Engineer",
  "Software Engineer, New Grad", "Mobile Engineer", "Infrastructure Engineer", "Product Engineer", "Forward Deployed Engineer",
];
const ROLE_POOLS = {
  maya: ["Software Engineering Intern", "Backend Intern", "Frontend Intern", "Mobile Intern", "Data Engineering Intern", "Platform Intern", "Full Stack Intern", "QA Automation Intern", "Developer Tools Intern", "Systems Intern"],
  ravi: ["Machine Learning Engineer", "AI Engineer", "Applied Scientist", "ML Platform Engineer", "Research Engineer", "NLP Engineer", "Evaluation Engineer", "AI Product Engineer", "Data Scientist", "Retrieval Engineer"],
  sam: ["Product Engineer", "Software Engineer, New Grad", "Full Stack Engineer", "Embedded Software Engineer", "Software Engineer, Co-op", "Founding Engineer", "Frontend Engineer", "Software Engineer, Product", "Solutions Engineer", "Growth Engineer"],
  lena: ["Product Designer", "UX Designer", "Visual Designer", "Brand Designer", "Design Systems Designer", "Interaction Designer", "Mobile Designer", "Motion Designer", "UX Researcher", "Design Engineer"],
  dev: ENGINEERING_ROLES.concat(["Founding Engineer", "Staff Engineer", "Engineering Manager", "Head of Platform", "Solutions Architect"]),
} satisfies Record<PersonKey, string[]>;

const PLANS: Record<PersonKey, Plan> = {
  maya: { live: true, founderRows: 0, jobs: { assessment: 1, screen: 0, interview: 0, offer: 0 }, founder: ZERO, intros: 0, roles: ROLE_POOLS.maya },
  ravi: { founderRows: 0, jobs: { assessment: 8, screen: 4, interview: 4, offer: 1 }, founder: ZERO, intros: 1, roles: ROLE_POOLS.ravi },
  sam: { founderRows: 0, jobs: { assessment: 7, screen: 3, interview: 6, offer: 2 }, founder: ZERO, intros: 2, roles: ROLE_POOLS.sam },
  lena: { founderRows: 0, jobs: { assessment: 2, screen: 3, interview: 3, offer: 1 }, founder: ZERO, intros: 1, roles: ROLE_POOLS.lena },
  dev: { founderRows: 50, jobs: { assessment: 28, screen: 16, interview: 14, offer: 2 }, founder: { assessment: 0, screen: 6, interview: 4, offer: 1 }, intros: 6, roles: ROLE_POOLS.dev },
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

type Rng = () => number;
const between = (rng: Rng, low: number, high: number) => low + Math.floor(rng() * (high - low + 1));
const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

type Draft = { when: number; from: string; subject: string; body: string };
type Target = { company: string; role: string; founder: boolean };

function jobsDraft(kind: string, t: Target, first: string, when: number): Draft {
  const domain = `${slug(t.company)}.com`;
  const careers = `${t.company} Careers <noreply@${domain}>`;
  const talent = `${t.company} Talent Team <talent@${domain}>`;
  const roleLine = `Role: ${t.role}`;
  switch (kind) {
    case "applied":
      return { when, from: careers, subject: `Thanks for applying to ${t.company}`, body: `Hi ${first},\n\nThanks for your interest in ${t.company}. We received your application and our team will review it. If your background is a match for what we need, we will be in touch.\n\n${roleLine}` };
    case "assessment":
      return { when, from: talent, subject: `Next step: take-home for ${t.company}`, body: `Hi ${first},\n\nThanks for your patience with your application. The next step is a short take-home assessment. Plan on about two hours and send it back within five days.\n\n${roleLine}` };
    case "screen":
      return { when, from: talent, subject: `Can we set up a phone screen?`, body: `Hi ${first},\n\nWe would love a 20 minute phone screen to learn more about you and answer questions about ${t.company}. Reply with a few times that work.\n\n${roleLine}` };
    case "interview":
      return { when, from: `${t.company} Hiring <hiring@${domain}>`, subject: `Interview invitation: ${t.role}`, body: `Hi ${first},\n\nWe would like to invite you to an interview with the team. It runs about 90 minutes over video with three short conversations.\n\n${roleLine}` };
    case "offer":
      return { when, from: `${t.company} Hiring <hiring@${domain}>`, subject: `Your offer letter from ${t.company}`, body: `Hi ${first},\n\nWe are pleased to offer you the ${t.role} position at ${t.company}. The full details are attached, and we hope you will join us.\n\n${roleLine}` };
    default:
      return { when, from: careers, subject: `Update on your application to ${t.company}`, body: `Hi ${first},\n\nThank you for your time. Unfortunately we will not be moving forward with your application right now. We will keep your details on file.\n\n${roleLine}` };
  }
}

function founderDraft(kind: string, t: Target, first: string, when: number): Draft {
  const from = `${t.company} <apply@${slug(t.company)}.vc>`;
  const roleLine = `Role: ${t.role}`;
  switch (kind) {
    case "applied":
      return { when, from, subject: `Thanks for applying: ${t.role}`, body: `Hi ${first},\n\nThanks for applying to ${t.company}. We back founders early and read every application.\n\n${roleLine}` };
    case "screen":
      return { when, from, subject: `Intro call with the ${t.company} team`, body: `Hi ${first},\n\nWe would like a short intro call to hear about what you are building. We work with founders at the earliest stage.\n\n${roleLine}` };
    case "interview":
      return { when, from, subject: `Partner meeting: ${t.company}`, body: `Hi ${first},\n\nYou are invited to a partner meeting. Bring a short demo and the questions you most want answered by founders who have been there.\n\n${roleLine}` };
    case "offer":
      return { when, from, subject: `Offer from ${t.company}`, body: `Hi ${first},\n\nWe are pleased to offer you a place with ${t.company}. A short note on terms is attached for you and your co-founder.\n\n${roleLine}` };
    default:
      return { when, from, subject: `Update on your application to ${t.company}`, body: `Hi ${first},\n\nThank you for sharing your plans. Unfortunately we will not be moving forward this round, although many founders reapply later.\n\n${roleLine}` };
  }
}

const NEWSLETTERS: Array<[string, string, string]> = [
  ["Weeknight Table <news@weeknighttable.com>", "Five dinners under 30 minutes", "This week: lemon pasta, sheet-pan chicken and a crisp slaw."],
  ["Trailhead Weekly <hello@trailheadweekly.com>", "Seven day hikes within an hour of town", "Pack water, bring layers and start early."],
  ["The Commuter <letters@thecommuter.news>", "Your Monday reading list", "Longform picks on cities, buses and why trains run late."],
  ["Campus Bookstore <deals@campusbookstore.shop>", "Textbook swap this Friday", "Bring your used books and trade for credit."],
];

function buildSchedule(person: Person, rng: Rng): Draft[] {
  const plan = PLANS[person.key];
  const first = person.profile.firstName;
  const drafts: Draft[] = [];
  const jobsCount = person.volume - plan.founderRows;

  const pairs: Target[] = shuffle(
    rng,
    FICTIONAL_COMPANIES.flatMap((company) => plan.roles.map((role) => ({ company, role, founder: false }))),
  ).slice(0, jobsCount);
  if (plan.live) {
    // One recent thread that is still alive: applied a week ago, assessment sent three days ago.
    const live = pairs.pop();
    if (live) {
      drafts.push(jobsDraft("applied", live, first, ANCHOR_MS - 8 * DAY_MS));
      drafts.push(jobsDraft("assessment", live, first, ANCHOR_MS - 3 * DAY_MS));
    }
  }
  const founderPairs: Target[] = shuffle(
    rng,
    [
      ...FOUNDER_ACCELERATORS.flatMap((company) => FOUNDER_ACCELERATOR_ROUNDS.map((role) => ({ company, role, founder: true }))),
      ...FOUNDER_FUNDS.flatMap((company) => FOUNDER_FUND_ROUNDS.map((role) => ({ company, role, founder: true }))),
    ],
  ).slice(0, plan.founderRows);

  const groups: Array<[Target[], Buckets]> = [
    [pairs, plan.jobs],
    [founderPairs, plan.founder],
  ];
  for (const [targets, buckets] of groups) {
    const stagePaths: string[][] = [
      ...Array<string[]>(buckets.offer).fill(["assessment", "screen", "interview", "offer"]),
      ...Array<string[]>(buckets.interview).fill(["assessment", "screen", "interview"]),
      ...Array<string[]>(buckets.screen).fill(["screen"]),
      ...Array<string[]>(buckets.assessment).fill(["assessment"]),
    ];
    targets.forEach((target, index) => {
      const path = (stagePaths[index] ?? []).filter((stage) => !(target.founder && stage === "assessment"));
      const deep = path.length > 0;
      const daysAgo = deep ? between(rng, 22, 89) : between(rng, 0, 89);
      let when = ANCHOR_MS - daysAgo * DAY_MS - between(rng, 0, 9) * HOUR_MS;
      const make = target.founder ? founderDraft : jobsDraft;
      drafts.push(make("applied", target, first, when));
      for (const stage of path) {
        when = Math.min(ANCHOR_MS, when + between(rng, 3, 8) * DAY_MS + HOUR_MS);
        drafts.push(make(stage, target, first, when));
      }
      const isOffer = path[path.length - 1] === "offer";
      const rejectChance = deep ? 0.65 : 0.35;
      const canReject = deep || daysAgo >= 10;
      if (!isOffer && canReject && rng() < rejectChance) {
        when = Math.min(ANCHOR_MS, when + between(rng, 2, 7) * DAY_MS + 2 * HOUR_MS);
        drafts.push(make("rejection", target, first, when));
      }
    });
  }

  const introCompanies = shuffle(rng, FICTIONAL_COMPANIES).slice(0, plan.intros);
  introCompanies.forEach((company) => {
    const when = ANCHOR_MS - between(rng, 1, 60) * DAY_MS;
    drafts.push({
      when,
      from: `Founders at ${company} <hello@${slug(company)}.com>`,
      subject: `Introduction: ${first} and the ${company} founders`,
      body: `Hi ${first},\n\nA mutual friend asked me to make this introduction. I am introducing you to the founders of ${company}, who are building a small team and are curious about your work.`,
    });
  });

  const newsletterCount = 3 + Math.round(person.volume / 40);
  for (let i = 0; i < newsletterCount; i += 1) {
    const [from, subject, body] = pick(rng, NEWSLETTERS);
    drafts.push({ when: ANCHOR_MS - between(rng, 0, 80) * DAY_MS, from, subject, body });
  }
  return drafts;
}

// What moved overnight, so this morning's brief has news to carry. Every move lands between midnight and 7:00 on
// INBOX_TODAY, before the 8:02 brief, so the board's Today card shows it too. A reply advances an application already
// in the person's inbox (so applied counts do not change): the same role exactly, still open, and at least three days
// old. A move whose application is not there is dropped, as happens for a seed other than 1; inbox.test pins that
// every one lands. An intro move is a founder writing back on an intro.
type ReplyMove = Target & { kind: "assessment" | "screen" | "interview" | "rejection"; at: string };
type IntroMove = { kind: "intro"; company: string; at: string };
export type OvernightMove = ReplyMove | IntroMove;

const jobTarget = (company: string, role: string) => ({ company, role, founder: false });
export const OVERNIGHT: Partial<Record<PersonKey, OvernightMove[]>> = {
  ravi: [
    { ...jobTarget("Ostrava Labs", "Retrieval Engineer"), kind: "assessment", at: "2026-11-07T02:15:00.000Z" },
    { ...jobTarget("Jetsam Works", "Applied Scientist"), kind: "rejection", at: "2026-11-07T05:00:00.000Z" },
  ],
  sam: [
    { ...jobTarget("Cindermoor Cloud", "Software Engineer, New Grad"), kind: "interview", at: "2026-11-07T01:30:00.000Z" },
    { ...jobTarget("Tarnmoor Robotics", "Founding Engineer"), kind: "screen", at: "2026-11-07T04:00:00.000Z" },
    { kind: "intro", company: "Lumora Health", at: "2026-11-07T06:10:00.000Z" },
  ],
  lena: [
    { ...jobTarget("Alder Forge", "Interaction Designer"), kind: "rejection", at: "2026-11-07T04:30:00.000Z" },
    { ...jobTarget("Velmora Loft", "Product Designer"), kind: "interview", at: "2026-11-07T06:00:00.000Z" },
  ],
  dev: [
    { ...jobTarget("Tessel Harbor", "Founding Engineer"), kind: "interview", at: "2026-11-07T02:00:00.000Z" },
    { company: "Oriel Partners", role: "Seed intro", founder: true, kind: "screen", at: "2026-11-07T06:30:00.000Z" },
  ],
};

const MIN_REPLY_AGE_MS = 3 * DAY_MS;
const sameDraft = (a: Draft, b: Draft) => a.from === b.from && a.subject === b.subject && a.body === b.body;

/** True when the application's own confirmation is in `base`, it is old enough to hear back, and nothing closed it. */
function openApplication(base: Draft[], t: Target, first: string, at: number): boolean {
  const make = t.founder ? founderDraft : jobsDraft;
  const applied = make("applied", t, first, 0);
  const closing = ["rejection", "offer"].map((kind) => make(kind, t, first, 0));
  const confirmation = base.find((draft) => sameDraft(draft, applied));
  return confirmation !== undefined && confirmation.when <= at - MIN_REPLY_AGE_MS && !base.some((draft) => closing.some((closed) => sameDraft(draft, closed)));
}

function introReplyDraft(company: string, first: string, when: number): Draft {
  return {
    when,
    from: `Founders at ${company} <hello@${slug(company)}.example>`,
    subject: `Re: Introduction: ${first} and the ${company} founders`,
    body: `Hi ${first},\n\nThanks for the introduction. We are a small team and your work is close to what we are building. Pick a time this week that suits you and we will be there.`,
  };
}

function overnightDrafts(person: Person, base: Draft[]): Draft[] {
  const first = person.profile.firstName;
  return (OVERNIGHT[person.key] ?? []).flatMap((move) => {
    const at = Date.parse(move.at);
    if (move.kind === "intro") return [introReplyDraft(move.company, first, at)];
    if (!openApplication(base, move, first, at)) return [];
    return [(move.founder ? founderDraft : jobsDraft)(move.kind, move, first, at)];
  });
}

export function generateInbox(person: Person, seed = 1): InboxEmail[] {
  const rng = mulberry32(seed * 7919 + hashString(person.key));
  const base = buildSchedule(person, rng);
  const sorted = [...base].sort((a, b) => a.when - b.when);
  // The overnight moves come last, so every other id stays where it was.
  const drafts = [...sorted, ...(seed === 1 ? overnightDrafts(person, base) : [])];
  return drafts.map((draft, index) => ({
    id: `${person.key}-${String(index + 1).padStart(4, "0")}`,
    from: draft.from,
    subject: draft.subject,
    body: draft.body,
    date: new Date(draft.when).toISOString(),
  }));
}
