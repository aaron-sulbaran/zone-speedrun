import { speedrunCopy } from "@/lib/content/speedrun";
import { STAGES } from "./pipeline";
import type { AppRow, Exit, Lane, Pipeline, Stage } from "./types";

export type FlowNode = { id: string; label: string; kind: "lane" | "hub" | "stage" | "exit"; column: number };
export type FlowLink = { source: string; target: string; value: number; tone: "flow" | "rejected" | "noreply" | "open" };
export type FlowData = { nodes: FlowNode[]; links: FlowLink[] };

const STAGE_COLUMN_START = 2;
const LANES: Lane[] = ["jobs", "founder"];
const EXITS: Exit[] = ["rejected", "noreply", "open"];

const stageId = (stage: Stage) => `stage:${stage}`;
const exitId = (exit: Exit, stage: Stage) => `exit:${exit}:${stage}`;
const stageColumn = (stage: Stage) => STAGE_COLUMN_START + STAGES.indexOf(stage);

export function toFlow(pipeline: Pipeline): FlowData {
  const { rows } = pipeline;
  if (rows.length === 0) return { nodes: [], links: [] };
  const labels = speedrunCopy.flow;
  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const link = (source: string, target: string, value: number, tone: FlowLink["tone"]) => {
    if (value > 0) links.push({ source, target, value, tone });
  };

  for (const lane of LANES) {
    const count = rows.filter((row: AppRow) => row.lane === lane).length;
    if (count === 0) continue;
    nodes.push({ id: `lane:${lane}`, label: labels.lanes[lane], kind: "lane", column: 0 });
    link(`lane:${lane}`, "hub", count, "flow");
  }
  nodes.push({ id: "hub", label: labels.hub, kind: "hub", column: 1 });

  const reached = (stage: Stage) => rows.filter((row) => STAGES.indexOf(row.furthest) >= STAGES.indexOf(stage));
  const topIndex = Math.max(...rows.map((row) => STAGES.indexOf(row.furthest)));

  STAGES.slice(0, topIndex + 1).forEach((stage, index) => {
    nodes.push({ id: stageId(stage), label: labels.stages[stage], kind: "stage", column: stageColumn(stage) });
    if (index === 0) link("hub", stageId(stage), rows.length, "flow");
    const next = STAGES[index + 1];
    if (next && index < topIndex) link(stageId(stage), stageId(next), reached(next).length, "flow");
    for (const exit of EXITS) {
      const count = rows.filter((row) => row.furthest === stage && row.exit === exit).length;
      if (count === 0) continue;
      nodes.push({ id: exitId(exit, stage), label: labels.exits[exit], kind: "exit", column: stageColumn(stage) + 1 });
      link(stageId(stage), exitId(exit, stage), count, exit);
    }
  });

  return { nodes, links };
}
