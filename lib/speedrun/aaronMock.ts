import { speedrunCopy } from "@/lib/content/speedrun";
import { toFlow, type FlowData } from "./funnel";
import type { AppRow, Exit, Pipeline, Stage } from "./types";

// Aaron's fall search with the counts nudged for privacy. Every number here is
// a literal; nothing is computed from private data. `AppRow.lane` only allows
// "jobs" | "founder", so every row is a "jobs" row and its track (internship,
// co-op, full-time, fellowship) rides beside it in AARON_ENTRIES, the single
// source of truth. The rows and the lane links come from it.

export type AaronTrack = "internship" | "coop" | "fulltime" | "fellowship";
export type AaronEntry = { track: AaronTrack; row: AppRow };

const TRACK_SIZES: [AaronTrack, number][] = [
  ["internship", 39],
  ["coop", 25],
  ["fulltime", 17],
  ["fellowship", 3],
];

// [furthest, exit, how many]. Furthest reached, cumulative: 84, 15, 12, 8, 2.
const OUTCOMES: [Stage, Exit, number][] = [
  ["applied", "noreply", 44],
  ["applied", "rejected", 14],
  ["applied", "open", 11],
  ["assessment", "rejected", 2],
  ["assessment", "open", 1],
  ["screen", "rejected", 2],
  ["screen", "open", 2],
  ["interview", "rejected", 4],
  ["interview", "open", 2],
  ["offer", "open", 2],
];

const STARTUPS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `Startup ${letter}`);
const ROLES: Record<AaronTrack, string[]> = {
  internship: ["Product role", "Engineering role"],
  coop: ["Engineering role", "Product role"],
  fulltime: ["Engineering role", "Product role"],
  fellowship: ["Fellowship"],
};

function companyFor(track: AaronTrack, index: number): string {
  if (track === "fellowship") return "Fellowship program";
  if (track === "fulltime" && index % 5 === 0) return "Big tech co";
  return STARTUPS[index % STARTUPS.length];
}

const outcomes = OUTCOMES.flatMap(([furthest, exit, count]) => Array.from({ length: count }, () => ({ furthest, exit })));
const tracks = TRACK_SIZES.flatMap(([track, count]) => Array.from({ length: count }, () => track));

export const AARON_ENTRIES: AaronEntry[] = tracks.map((track, i) => {
  // 37 is coprime to 84, so this spreads the outcomes across tracks, deterministically.
  const outcome = outcomes[(i * 37) % outcomes.length];
  const roles = ROLES[track];
  return {
    track,
    row: {
      company: companyFor(track, i),
      role: roles[i % roles.length],
      lane: "jobs",
      ...outcome,
      lastEventAt: "2026-10-15",
      next: null,
    },
  };
});

export const AARON_MOCK: Pick<Pipeline, "rows"> = {
  rows: AARON_ENTRIES.map((entry) => entry.row),
};

/** The flow. By default the first column is Aaron's four tracks; `lanes: false` is the plain funnel the hero draws. */
export function aaronFlow({ lanes = true }: { lanes?: boolean } = {}): FlowData {
  // All rows share one lane, so "auto" already leaves the lane column out.
  if (!lanes) return toFlow(AARON_MOCK);
  const base = toFlow(AARON_MOCK, { laneColumn: "always" });
  const labels = speedrunCopy.act1.lanes;
  const present = TRACK_SIZES.map(([track]) => track).filter((track) => AARON_ENTRIES.some((e) => e.track === track));
  return {
    nodes: [
      ...present.map((track) => ({ id: `lane:${track}`, label: labels[track], kind: "lane" as const, column: 0 })),
      ...base.nodes.filter((node) => node.kind !== "lane"),
    ],
    links: [
      ...present.map((track) => ({
        source: `lane:${track}`,
        target: "stage:applied",
        value: AARON_ENTRIES.filter((e) => e.track === track).length,
        tone: "flow" as const,
      })),
      ...base.links.filter((link) => !link.source.startsWith("lane:")),
    ],
  };
}
