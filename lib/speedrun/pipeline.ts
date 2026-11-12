import { speedrunCopy } from "@/lib/content/speedrun";
import type { AppRow, Exit, InboxEvent, Lane, Pipeline, Stage } from "./types";

export const STAGES: Stage[] = ["applied", "assessment", "screen", "interview", "offer"];
const NO_REPLY_DAYS = 21;
const DAY_MS = 86_400_000;
const ROW_KINDS = new Set(["applied", "assessment", "screen", "interview", "offer", "rejection"]);

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
}

const companyKey = (company: string) => company.toLowerCase().replace(/[^a-z0-9]+/g, "");
// board.ts gives every pasted email an id that starts "pasted-"; sample ids start with the person's key.
const fromPaste = (event: InboxEvent) => event.emailId.startsWith("pasted-");
const roleKey = (role: string | null) => (role ?? "").toLowerCase().trim();

type Group = { company: string; role: string | null; events: InboxEvent[] };

function lastDate(group: Group): string {
  return group.events[group.events.length - 1].date;
}

/** True when the name's leading whole words spell the key: "Halden Robotics" starts with "halden", "Haldenrobotics" does not. */
function startsWithWords(name: string, key: string): boolean {
  let spelled = "";
  for (const word of name.split(/\s+/)) {
    spelled += companyKey(word);
    if (spelled === key) return true;
    if (!key.startsWith(spelled)) return false;
  }
  return false;
}

/**
 * "Halden" and "Halden Robotics" are one company: a key folds into the longer key whose name starts with its words.
 * When two different longer names share the prefix ("Acme Bank" and "Acme Robotics"), nothing folds.
 */
function foldedKeys(events: InboxEvent[]): Map<string, string> {
  const names = new Map<string, Set<string>>();
  for (const event of events) {
    const key = companyKey(event.company);
    names.set(key, (names.get(key) ?? new Set<string>()).add(event.company));
  }
  const folded = new Map<string, string>();
  for (const key of names.keys()) {
    if (!key) continue;
    const longer = [...names]
      .filter(([other, otherNames]) => other !== key && other.startsWith(key) && [...otherNames].some((name) => startsWithWords(name, key)))
      .map(([other]) => other)
      .sort((a, b) => b.length - a.length);
    if (longer.length > 0 && longer.every((other) => longer[0].startsWith(other))) folded.set(key, longer[0]);
  }
  return folded;
}

/** One company can have several roles; an event with no role joins that company's latest row. */
function groupByApplication(events: InboxEvent[]): Map<string, Group[]> {
  const byCompany = new Map<string, Group[]>();
  const sorted = events
    .filter((event) => ROW_KINDS.has(event.kind))
    .sort((a, b) => a.date.localeCompare(b.date));
  // Folding stays within one source, so a pasted "Cobalt" never joins the sample's "Cobalt Meadow".
  const pasted = foldedKeys(sorted.filter(fromPaste));
  const sample = foldedKeys(sorted.filter((event) => !fromPaste(event)));
  for (const event of sorted) {
    const own = companyKey(event.company);
    const key = (fromPaste(event) ? pasted : sample).get(own) ?? own;
    const groups = byCompany.get(key) ?? [];
    byCompany.set(key, groups);
    let target: Group | undefined;
    if (event.role) {
      target = groups.find((group) => roleKey(group.role) === roleKey(event.role));
      if (!target) {
        const open = groups.find((group) => group.role === null);
        if (open) {
          open.role = event.role;
          target = open;
        }
      }
    } else if (groups.length > 0) {
      target = groups.reduce((latest, group) => (lastDate(group) >= lastDate(latest) ? group : latest));
    }
    if (!target) {
      target = { company: event.company, role: event.role, events: [] };
      groups.push(target);
    }
    target.events.push(event);
  }
  return byCompany;
}

export function buildPipeline(events: InboxEvent[], today: string): Pipeline {
  const rows: AppRow[] = [];

  for (const groups of groupByApplication(events).values()) {
    const all = groups.flatMap((group) => group.events).sort((a, b) => a.date.localeCompare(b.date));
    const lane: Lane = all[0].lane;
    for (const group of groups) {
      const last = group.events[group.events.length - 1];
      let furthest: Stage = "applied";
      for (const event of group.events) {
        const stage = STAGES.find((candidate) => candidate === event.kind);
        if (stage && STAGES.indexOf(stage) > STAGES.indexOf(furthest)) furthest = stage;
      }
      let exit: Exit = "open";
      if (last.kind === "rejection") exit = "rejected";
      else if (last.kind === "applied" && daysBetween(last.date, today) > NO_REPLY_DAYS) exit = "noreply";
      rows.push({
        company: group.company,
        role: group.role,
        lane,
        furthest,
        exit,
        appliedAt: group.events.find((event) => event.kind === "applied")?.date ?? null,
        lastEventAt: last.date,
        next: exit === "open" ? speedrunCopy.board.next[furthest] : null,
      });
    }
  }
  rows.sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt) || a.company.localeCompare(b.company));

  return {
    rows,
    stats: {
      applied: rows.length,
      inProcess: rows.filter((row) => row.exit === "open" && row.furthest !== "applied" && row.furthest !== "offer").length,
      offers: rows.filter((row) => row.exit === "open" && row.furthest === "offer").length,
    },
  };
}
