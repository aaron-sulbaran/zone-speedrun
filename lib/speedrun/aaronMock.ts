import { speedrunCopy } from "@/lib/content/speedrun";
import { toFlow, type FlowData } from "./funnel";
import type { AppRow, Exit, Pipeline, Stage } from "./types";

// Aaron's fall search with the counts nudged for privacy. Every number here is
// a literal; nothing is computed from private data. `AppRow.lane` only allows
// "jobs" | "founder", so every row is a "jobs" row and the four tracks live in
// a parallel list that `aaronFlow` uses to relabel the first column.

export type AaronTrack = "internship" | "coop" | "fulltime" | "fellowship";

export const AARON_TRACKS: Record<AaronTrack, number> = { internship: 39, coop: 25, fulltime: 17, fellowship: 3 };

// [furthest, exit, how many]. Furthest reached cumulative: 84, 15, 12, 8, 2.
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
const ROLE_FOR_TRACK: Record<AaronTrack, string[]> = {
  internship: ["Product role", "Engineering role"],
  coop: ["Co-op"],
  fulltime: ["Engineering role", "Product role"],
  fellowship: ["Fellowship"],
};

function companyFor(track: AaronTrack, index: number): string {
  if (track === "fellowship") return "Fellowship program";
  if (track === "fulltime" && index % 5 === 0) return "Big tech co";
  return STARTUPS[index % STARTUPS.length];
}

const outcomes = OUTCOMES.flatMap(([furthest, exit, count]) => Array.from({ length: count }, () => ({ furthest, exit })));
// Interleave so every track gets a spread of outcomes, deterministically.
const order = outcomes.map((_, i) => (i * 37) % outcomes.length);
const tracks = (Object.keys(AARON_TRACKS) as AaronTrack[]).flatMap((track) =>
  Array.from({ length: AARON_TRACKS[track] }, () => track),
);

export const AARON_ROW_TRACKS: AaronTrack[] = tracks;

export const AARON_MOCK: Pipeline = {
  rows: order.map((outcomeIndex, i): AppRow => {
    const track = tracks[i];
    const roles = ROLE_FOR_TRACK[track];
    return {
      company: companyFor(track, i),
      role: roles[i % roles.length],
      lane: "jobs",
      ...outcomes[outcomeIndex],
      lastEventAt: "2026-10-15",
      next: null,
    };
  }),
  stats: { applied: 84, inProcess: 18, intros: 2, offers: 2 },
};

/** The flow with the first column relabelled into Aaron's four tracks. */
export function aaronFlow(): FlowData {
  const base = toFlow(AARON_MOCK);
  const labels = speedrunCopy.act1.lanes;
  const trackKeys = Object.keys(AARON_TRACKS) as AaronTrack[];
  return {
    nodes: [
      ...trackKeys.map((track) => ({ id: `lane:${track}`, label: labels[track], kind: "lane" as const, column: 0 })),
      ...base.nodes.filter((node) => node.kind !== "lane"),
    ],
    links: [
      ...trackKeys.map((track) => ({
        source: `lane:${track}`,
        target: "hub",
        value: AARON_TRACKS[track],
        tone: "flow" as const,
      })),
      ...base.links.filter((link) => !link.source.startsWith("lane:")),
    ],
  };
}
