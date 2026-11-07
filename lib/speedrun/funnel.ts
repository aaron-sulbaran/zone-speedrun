import { speedrunCopy } from "@/lib/content/speedrun";
import { STAGES } from "./pipeline";
import type { AppRow, Exit, Lane, Pipeline, Stage } from "./types";

export type FlowNode = { id: string; label: string; kind: "lane" | "stage" | "exit"; column: number };
export type FlowLink = { source: string; target: string; value: number; tone: "flow" | "rejected" | "noreply" | "open" };
export type FlowData = { nodes: FlowNode[]; links: FlowLink[] };

const LANES: Lane[] = ["jobs", "founder"];
const EXITS: Exit[] = ["rejected", "noreply", "open"];

const stageId = (stage: Stage) => `stage:${stage}`;
const exitId = (exit: Exit, stage: Stage) => `exit:${exit}:${stage}`;

export function toFlow(pipeline: Pipeline): FlowData {
  const { rows } = pipeline;
  if (rows.length === 0) return { nodes: [], links: [] };
  const labels = speedrunCopy.flow;
  // One lane is just the whole search, so it gets no column of its own.
  const laneCount = LANES.filter((lane) => rows.some((row) => row.lane === lane)).length;
  const firstStageColumn = laneCount > 1 ? 1 : 0;
  const stageColumn = (stage: Stage) => firstStageColumn + STAGES.indexOf(stage);
  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const link = (source: string, target: string, value: number, tone: FlowLink["tone"]) => {
    if (value > 0) links.push({ source, target, value, tone });
  };

  for (const lane of laneCount > 1 ? LANES : []) {
    const count = rows.filter((row: AppRow) => row.lane === lane).length;
    if (count === 0) continue;
    nodes.push({ id: `lane:${lane}`, label: labels.lanes[lane], kind: "lane", column: 0 });
    link(`lane:${lane}`, stageId("applied"), count, "flow");
  }

  const reached = (stage: Stage) => rows.filter((row) => STAGES.indexOf(row.furthest) >= STAGES.indexOf(stage));
  const topIndex = Math.max(...rows.map((row) => STAGES.indexOf(row.furthest)));

  STAGES.slice(0, topIndex + 1).forEach((stage, index) => {
    nodes.push({ id: stageId(stage), label: labels.stages[stage], kind: "stage", column: stageColumn(stage) });
    const next = STAGES[index + 1];
    if (next && index < topIndex) link(stageId(stage), stageId(next), reached(next).length, "flow");
    // An offer ends the flow; its rows have no exit after it.
    for (const exit of stage === "offer" ? [] : EXITS) {
      const count = rows.filter((row) => row.furthest === stage && row.exit === exit).length;
      if (count === 0) continue;
      nodes.push({ id: exitId(exit, stage), label: labels.exits[exit], kind: "exit", column: stageColumn(stage) + 1 });
      link(stageId(stage), exitId(exit, stage), count, exit);
    }
  });

  return { nodes, links };
}
