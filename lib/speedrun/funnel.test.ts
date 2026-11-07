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

  it("sends every row out of the hub", () => {
    const fromHub = flow.links.filter((link) => link.source === "hub");
    expect(fromHub.reduce((sum, link) => sum + link.value, 0)).toBe(rows.length);
  });

  it("feeds the hub from the lanes", () => {
    const intoHub = flow.links.filter((link) => link.target === "hub");
    expect(intoHub.reduce((sum, link) => sum + link.value, 0)).toBe(rows.length);
  });

  it("has no zero value links", () => {
    expect(flow.links.every((link) => link.value > 0)).toBe(true);
  });

  it("gives each exit a unique id and a column one after its stage", () => {
    const exits = flow.nodes.filter((node) => node.kind === "exit");
    expect(new Set(exits.map((node) => node.id)).size).toBe(exits.length);
    const applied = exits.find((node) => node.id === "exit:noreply:applied");
    expect(applied?.column).toBe(3);
    expect(flow.nodes.find((node) => node.id === "exit:open:offer")?.column).toBe(7);
  });

  it("places lanes, hub and stages in their columns", () => {
    const column = (id: string) => flow.nodes.find((node) => node.id === id)?.column;
    expect(column("lane:jobs")).toBe(0);
    expect(column("hub")).toBe(1);
    expect(column("stage:applied")).toBe(2);
    expect(column("stage:offer")).toBe(6);
  });

  it("only links existing nodes", () => {
    const ids = new Set(flow.nodes.map((node) => node.id));
    expect(flow.links.every((link) => ids.has(link.source) && ids.has(link.target))).toBe(true);
  });

  it("returns an empty flow for an empty pipeline", () => {
    expect(toFlow({ rows: [], stats: { applied: 0, inProcess: 0, intros: 0, offers: 0 } })).toEqual({ nodes: [], links: [] });
  });
});
