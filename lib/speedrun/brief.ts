import { speedrunCopy } from "@/lib/content/speedrun";
import type { MatchResult } from "./match";
import type { Person, PersonKey, Pipeline } from "./types";

export type BriefItem = { kind: "reply" | "new-role" | "due" | "intro"; text: string; href: string | null };
export type Brief = { personKey: PersonKey | "you"; date: string; cadence: Person["cadence"]; items: BriefItem[] };

export type BriefInput = {
  firstName: string;
  cadence: Person["cadence"];
  pipeline: Pipeline;
  result: MatchResult;
  /** ISO date of the morning the brief goes out. */
  today: string;
  /** Companies whose founders wrote back, most recent first. */
  intros?: string[];
  personKey?: PersonKey | "you";
};

const copy = speedrunCopy.brief;
const DAY_MS = 86_400_000;
const MAX_ITEMS = 3;
const REPLY_STAGES = new Set(["assessment", "screen", "interview", "offer"]);

export const LOGO_URL = "https://speedrun-talent-network.com/skill/logos/base/svg/Horizontal_mono_color_on_light.svg";

function dayStart(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function safeHref(href: string | null): string | null {
  return href && /^https:\/\//i.test(href) ? href : null;
}

/** Only what changed since yesterday's midnight. A quiet night gives an empty list on purpose. */
export function composeBrief(input: BriefInput): Brief {
  const { pipeline, result, cadence, today } = input;
  const since = dayStart(today) - DAY_MS;
  const items: BriefItem[] = [];
  const seen = new Set<string>();
  const add = (company: string, item: BriefItem) => {
    const key = company.toLowerCase();
    if (seen.has(key) || items.length >= MAX_ITEMS) return;
    seen.add(key);
    items.push(item);
  };

  const [introCompany] = input.intros ?? [];
  if (introCompany) add(introCompany, { kind: "intro", text: copy.items.intro(introCompany), href: null });

  const open = pipeline.rows.filter((row) => row.exit === "open");
  const fresh = open
    .filter((row) => REPLY_STAGES.has(row.furthest) && Date.parse(row.lastEventAt) >= since)
    .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
  for (const row of fresh) {
    add(row.company, { kind: "reply", text: copy.items.reply(row.company, row.role ?? copy.fallbackRole), href: null });
  }

  // A standing deadline is worth a morning line for people who asked for one every day.
  if (cadence !== "on-change") {
    const assessments = open
      .filter((row) => row.furthest === "assessment")
      .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
    for (const row of assessments) {
      add(row.company, { kind: "due", text: copy.items.due(copy.dueWhat, row.company, copy.dueWhen), href: null });
    }
  }

  for (const match of result.matches) {
    const role = match.role;
    if (!role || Date.parse(role.postedAt) < since) continue;
    add(match.company.name, {
      kind: "new-role",
      text: copy.items.newRole(role.title, match.company.name),
      href: safeHref(role.url),
    });
  }

  const order: BriefItem["kind"][] = ["intro", "reply", "due", "new-role"];
  items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { personKey: input.personKey ?? "you", date: today, cadence, items };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function briefSubject(brief: Brief, firstName: string): string {
  return brief.items.length === 0 ? copy.quietSubject(firstName) : copy.subject(firstName, brief.items.length);
}

const PAPER = "#f6f3ec";
const INK = "#111111";
const MUTED = "#5b5750";
const RULE = "#d9d4c7";
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
    `<tr><td style="padding-bottom:24px;"><img src="${LOGO_URL}" width="160" alt="${escapeHtml(copy.logoAlt)}" style="display:block;border:0;height:auto;"></td></tr>`,
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
