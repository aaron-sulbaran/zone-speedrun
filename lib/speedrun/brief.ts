import { speedrunCopy } from "@/lib/content/speedrun";
import type { SnapshotRole } from "./snapshot";
import type { Person, PersonKey, Pipeline } from "./types";

/** `standing` items are worth a line but did not change overnight, so the subject does not count them. */
export type BriefItem = { kind: "reply" | "new-role" | "due" | "intro"; text: string; href: string | null; standing?: boolean };
export type Brief = { personKey: PersonKey | "you"; date: string; cadence: Person["cadence"]; items: BriefItem[] };

/** The few role fields the brief reads; the page and the server both build these from the snapshot by id. */
export type BriefRole = Pick<SnapshotRole, "id" | "title" | "company" | "tier" | "postedAt" | "url">;

export type BriefInput = {
  firstName: string;
  cadence: Person["cadence"];
  pipeline: Pipeline;
  /** The visitor's top matched roles in rank order. */
  roles: BriefRole[];
  /** ISO date of the morning the brief goes out. */
  today: string;
  /** Founders who wrote back, most recent first. */
  intros?: { company: string; date: string }[];
  personKey?: PersonKey | "you";
};

const copy = speedrunCopy.brief;
const DAY_MS = 86_400_000;
const MAX_ITEMS = 4;
const REPLY_STAGES = new Set(["assessment", "screen", "interview", "offer"]);

function dayStart(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function safeHref(href: string | null): string | null {
  return href && /^https:\/\//i.test(href) ? href : null;
}

const WEEK_MS = 7 * DAY_MS;

/** One role line from the ranked list: speedrun tier only, never one dated after the brief goes out. */
export function pickRole(roles: BriefRole[], cadence: Person["cadence"], since: number, until: number): { company: string; item: BriefItem } | null {
  const posted = (role: BriefRole) => Date.parse(role.postedAt);
  const eligible = roles.filter((role) => role.tier === "speedrun" && posted(role) < until);
  const overnight = eligible.find((role) => posted(role) >= since);
  if (overnight) {
    return { company: overnight.company, item: { kind: "new-role", text: copy.items.newRole(overnight.title, overnight.company), href: safeHref(overnight.url) } };
  }
  if (cadence === "on-change") return null;
  const [freshest] = [...eligible].sort((a, b) => posted(b) - posted(a));
  if (!freshest) return null;
  const thisWeek = posted(freshest) >= until - WEEK_MS;
  const text = thisWeek ? copy.items.newThisWeek(freshest.title, freshest.company) : copy.items.openRole(freshest.title, freshest.company);
  return { company: freshest.company, item: { kind: "new-role", text, href: safeHref(freshest.url), standing: true } };
}

/** Only what changed since yesterday's midnight. A quiet night gives an empty list on purpose. */
export function composeBrief(input: BriefInput): Brief {
  const { pipeline, roles, cadence, today } = input;
  const since = dayStart(today) - DAY_MS;
  const items: BriefItem[] = [];
  const seen = new Set<string>();
  const add = (company: string, item: BriefItem) => {
    const key = company.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const until = dayStart(today) + DAY_MS;
  // An intro that landed overnight is news. An older one is a standing line for daily readers and nothing for on-change readers.
  const intro = (input.intros ?? []).find((entry) => Date.parse(entry.date) < until && (cadence !== "on-change" || Date.parse(entry.date) >= since));
  if (intro) {
    const overnight = Date.parse(intro.date) >= since;
    add(intro.company, overnight
      ? { kind: "intro", text: copy.items.intro(intro.company), href: null }
      : { kind: "intro", text: copy.items.introStanding(intro.company), href: null, standing: true });
  }

  const open = pipeline.rows.filter((row) => row.exit === "open");
  // A rejection is a reply too: someone wrote back, and it is better heard in the morning than found later.
  const fresh = pipeline.rows
    .filter((row) => row.exit !== "noreply" && (REPLY_STAGES.has(row.furthest) || row.exit === "rejected") && Date.parse(row.lastEventAt) >= since && Date.parse(row.lastEventAt) < until)
    .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
  for (const row of fresh) {
    add(row.company, { kind: "reply", text: copy.items.reply(row.company, row.role ?? copy.fallbackRole), href: null });
  }

  // A standing deadline is worth a morning line for people who asked for one every day.
  if (cadence !== "on-change") {
    const assessments = open
      .filter((row) => row.furthest === "assessment")
      .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
    const [row] = assessments;
    if (row) add(row.company, { kind: "due", text: copy.items.due(copy.dueWhat, row.company, copy.dueWhen), href: null, standing: true });
  }

  const role = pickRole(roles, cadence, since, until);
  if (role) add(role.company, role.item);

  // What moved comes first, then what is still open: an intro, a role, a deadline.
  const rank = (item: BriefItem) => {
    const moved = ["intro", "reply", "new-role", "due"].indexOf(item.kind);
    const standing = ["intro", "new-role", "due", "reply"].indexOf(item.kind);
    return item.standing ? 10 + standing : moved;
  };
  items.sort((a, b) => rank(a) - rank(b));
  items.splice(MAX_ITEMS);
  return { personKey: input.personKey ?? "you", date: today, cadence, items };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function briefSubject(brief: Brief, firstName: string): string {
  const moved = brief.items.filter((item) => !item.standing).length;
  if (moved === 0 && brief.items.length > 0) {
    const tail = brief.items.length === 1 ? copy.stillOpen[brief.items[0].kind] : copy.stillOpenMany(brief.items.length);
    return `${copy.nothingNew(firstName)} ${tail}`;
  }
  if (moved === 0) return firstName ? copy.quietSubject(firstName) : copy.quietSubjectAnon;
  return firstName ? copy.subject(firstName, moved) : copy.subjectAnon(moved);
}

const PAPER = "#f6f3ec";
const INK = "#111111";
const MUTED = "#5b5750";
const RULE = "#d9d4c7";
const CONDENSED = "'Roboto Condensed', 'Arial Narrow', Arial, sans-serif";
const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** A fixed template: the only variable text is the first name and what the pipeline and matches say. */
export function renderBriefEmail(brief: Brief, firstName: string): { subject: string; html: string; text: string } {
  const subject = briefSubject(brief, firstName);
  const greeting = copy.greeting(firstName);
  const quiet = brief.items.length === 0;

  const rows = brief.items
    .map((item) => {
      const href = safeHref(item.href);
      const body = href
        ? `<a href="${escapeHtml(href)}" style="color:${INK};text-decoration:underline;">${escapeHtml(item.text)}</a>`
        : escapeHtml(item.text);
      return `<tr><td style="padding:14px 0;border-top:1px solid ${RULE};font:16px/1.5 ${FONT};color:${INK};">${body}</td></tr>`;
    })
    .join("");
  const bodyRows = quiet
    ? `<tr><td style="padding:14px 0;border-top:1px solid ${RULE};font:16px/1.5 ${FONT};color:${INK};">${escapeHtml(copy.quietBody)}</td></tr>`
    : rows;

  const html = [
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${PAPER};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};"><tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">`,
    // Mail apps do not draw SVG in an image, so the header is text in a condensed face, not their logo file.
    `<tr><td style="padding-bottom:24px;font:600 13px/1 ${CONDENSED};letter-spacing:0.14em;text-transform:uppercase;color:${INK};">${escapeHtml(copy.from)}</td></tr>`,
    `<tr><td style="font:600 20px/1.3 ${FONT};color:${INK};padding-bottom:12px;">${escapeHtml(greeting)}</td></tr>`,
    `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bodyRows}</table></td></tr>`,
    `<tr><td style="padding-top:28px;border-top:1px solid ${RULE};font:12px/1.5 ${FONT};color:${MUTED};">${escapeHtml(copy.footer)}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");

  const lines = [greeting, ""];
  if (quiet) lines.push(copy.quietBody);
  for (const item of brief.items) {
    lines.push(`- ${item.text}`);
    const href = safeHref(item.href);
    if (href) lines.push(`  ${href}`);
  }
  lines.push("", copy.footer);
  return { subject, html, text: lines.join("\n") };
}
