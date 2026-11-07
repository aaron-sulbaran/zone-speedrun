import type { AppRow, Exit, InboxEvent, Pipeline, Stage } from "./types";

export const STAGES: Stage[] = ["applied", "assessment", "screen", "interview", "offer"];
const NO_REPLY_DAYS = 21;
const DAY_MS = 86_400_000;

const NEXT_STEP: Record<Stage, string> = {
  applied: "Wait for a reply",
  assessment: "Finish the assessment",
  screen: "Prepare for the screen",
  interview: "Prepare for the interview",
  offer: "Decide on the offer",
};

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
}

function groupKey(event: InboxEvent): string {
  return `${event.lane}|${event.company.toLowerCase()}|${(event.role ?? "").toLowerCase()}`;
}

export function buildPipeline(events: InboxEvent[], today: string): Pipeline {
  const groups = new Map<string, InboxEvent[]>();
  let intros = 0;
  for (const event of events) {
    if (event.kind === "intro") intros += 1;
    if (event.kind === "other" || event.kind === "noreply" || event.kind === "intro") continue;
    const key = groupKey(event);
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  }

  const rows: AppRow[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    let furthest: Stage = "applied";
    for (const event of sorted) {
      const stage = STAGES.find((candidate) => candidate === event.kind);
      if (stage && STAGES.indexOf(stage) > STAGES.indexOf(furthest)) furthest = stage;
    }
    let exit: Exit = "open";
    if (last.kind === "rejection") exit = "rejected";
    else if (last.kind === "applied" && daysBetween(last.date, today) > NO_REPLY_DAYS) exit = "noreply";
    rows.push({
      company: sorted[0].company,
      role: sorted[0].role,
      lane: sorted[0].lane,
      furthest,
      exit,
      lastEventAt: last.date,
      next: exit === "open" ? NEXT_STEP[furthest] : null,
    });
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
