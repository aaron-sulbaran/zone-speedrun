import { describe, expect, it } from "vitest";
import { toFlow } from "./funnel";
import type { AppRow, Pipeline, Stage, Exit } from "./types";

function row(i: number, furthest: Stage, exit: Exit, lane: AppRow["lane"] = "jobs"): AppRow {
  return { company: `Co${i}`, role: "Engineer", lane, furthest, exit, lastEventAt: "2026-10-01", next: null };
}

const rows: AppRow[] = [
  row(1, "applied", "noreply"),
  row(2, "applied", "noreply"),
  row(3, "applied", "rejected"),
  row(4, "assessment", "rejected"),
  row(5, "screen", "open"),
  row(6, "interview", "rejected"),
  row(7, "interview", "open"),
  row(8, "offer", "open"),
  row(9, "applied", "open", "founder"),
];
const pipeline: Pipeline = { rows, stats: { applied: 9, inProcess: 3, intros: 0, offers: 1 } };

describe("toFlow", () => {
  const flow = toFlow(pipeline);

  it("sends every row out of Applied", () => {
    const fromApplied = flow.links.filter((link) => link.source === "stage:applied");
    expect(fromApplied.reduce((sum, link) => sum + link.value, 0)).toBe(rows.length);
  });

  it("feeds Applied straight from the lanes", () => {
    const intoApplied = flow.links.filter((link) => link.target === "stage:applied");
    expect(intoApplied.every((link) => link.source.startsWith("lane:"))).toBe(true);
    expect(intoApplied.reduce((sum, link) => sum + link.value, 0)).toBe(rows.length);
    expect(flow.nodes.some((node) => node.id === "hub")).toBe(false);
  });

  it("has no zero value links", () => {
    expect(flow.links.every((link) => link.value > 0)).toBe(true);
  });

  it("gives each exit a unique id and a column one after its stage", () => {
    const exits = flow.nodes.filter((node) => node.kind === "exit");
    expect(new Set(exits.map((node) => node.id)).size).toBe(exits.length);
    const applied = exits.find((node) => node.id === "exit:noreply:applied");
    expect(applied?.column).toBe(2);
    expect(flow.nodes.some((node) => node.id.startsWith("exit:") && node.id.endsWith(":offer"))).toBe(false);
  });

  it("places lanes and stages in their columns", () => {
    const column = (id: string) => flow.nodes.find((node) => node.id === id)?.column;
    expect(column("lane:jobs")).toBe(0);
    expect(column("stage:applied")).toBe(1);
    expect(column("stage:offer")).toBe(5);
  });

  it("drops the lane column when there is only one lane", () => {
    const single = toFlow({ rows: rows.filter((r) => r.lane === "jobs"), stats: pipeline.stats });
    expect(single.nodes.some((node) => node.kind === "lane")).toBe(false);
    expect(single.nodes.find((node) => node.id === "stage:applied")?.column).toBe(0);
    expect(single.links.every((link) => !link.source.startsWith("lane:"))).toBe(true);
    const ids = new Set(single.nodes.map((node) => node.id));
    expect(single.links.every((link) => ids.has(link.source) && ids.has(link.target))).toBe(true);
  });

  it("keeps a lane column for one lane when asked to", () => {
    const single = toFlow({ rows: rows.filter((r) => r.lane === "jobs"), stats: pipeline.stats }, { laneColumn: "always" });
    expect(single.nodes.filter((node) => node.kind === "lane").map((node) => node.id)).toEqual(["lane:jobs"]);
    expect(single.nodes.find((node) => node.id === "stage:applied")?.column).toBe(1);
  });

  it("only links existing nodes", () => {
    const ids = new Set(flow.nodes.map((node) => node.id));
    expect(flow.links.every((link) => ids.has(link.source) && ids.has(link.target))).toBe(true);
  });

  it("returns an empty flow for an empty pipeline", () => {
    expect(toFlow({ rows: [], stats: { applied: 0, inProcess: 0, intros: 0, offers: 0 } })).toEqual({ nodes: [], links: [] });
  });
});
