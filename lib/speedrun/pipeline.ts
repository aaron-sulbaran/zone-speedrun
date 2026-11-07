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
const roleKey = (role: string | null) => (role ?? "").toLowerCase().trim();

type Group = { company: string; role: string | null; events: InboxEvent[] };

function lastDate(group: Group): string {
  return group.events[group.events.length - 1].date;
}

/** One company can have several roles; an event with no role joins that company's latest row. */
function groupByApplication(events: InboxEvent[]): Map<string, Group[]> {
  const byCompany = new Map<string, Group[]>();
  const sorted = events
    .filter((event) => ROW_KINDS.has(event.kind))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const event of sorted) {
    const key = companyKey(event.company);
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
  const intros = events.filter((event) => event.kind === "intro").length;
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
      intros,
      offers: rows.filter((row) => row.furthest === "offer").length,
    },
  };
}
