import { describe, expect, it } from "vitest";
import { AARON_ENTRIES, AARON_MOCK, aaronFlow } from "./aaronMock";
import { getSnapshot } from "./snapshot";

describe("AARON_MOCK", () => {
  it("has 84 rows with generic company labels, none from the snapshot", () => {
    expect(AARON_MOCK.rows).toHaveLength(84);
    const generic = /^(Startup [A-Z]|Big tech co|Fellowship program)$/;
    const known = new Set(getSnapshot().companies.map((company) => company.name.toLowerCase()));
    for (const row of AARON_MOCK.rows) {
      expect(row.company).toMatch(generic);
      expect(known.has(row.company.toLowerCase())).toBe(false);
    }
  });

  it("matches the nudged counts", () => {
    const count = (test: (row: (typeof AARON_MOCK.rows)[number]) => boolean) => AARON_MOCK.rows.filter(test).length;
    expect(count((r) => r.exit === "rejected")).toBe(22);
    expect(count((r) => r.exit === "noreply")).toBe(44);
    expect(count((r) => r.exit === "open" && r.furthest !== "offer")).toBe(16);
    expect(count((r) => r.furthest === "offer" && r.exit === "open")).toBe(2);
    expect(AARON_MOCK.rows).toHaveLength(84);
  });

  it("keeps the track lanes in column 0 and every stage to their right", () => {
    const flow = aaronFlow();
    const lanes = flow.nodes.filter((node) => node.kind === "lane");
    expect(lanes.length).toBe(4);
    expect(lanes.every((node) => node.column === 0)).toBe(true);
    expect(flow.nodes.find((node) => node.id === "stage:applied")?.column).toBe(1);
    const laneColumns = new Set(lanes.map((node) => node.column));
    expect(flow.nodes.filter((node) => node.kind !== "lane").every((node) => !laneColumns.has(node.column))).toBe(true);
  });

  it("flows from four lanes through the stages", () => {
    const flow = aaronFlow();
    expect(flow.links.length).toBeGreaterThanOrEqual(8);
    const lanes = flow.nodes.filter((node) => node.kind === "lane");
    expect(lanes.map((node) => node.id).sort()).toEqual(
      ["lane:coop", "lane:fellowship", "lane:fulltime", "lane:internship"].sort(),
    );
    const intoHub = flow.links.filter((link) => link.target === "stage:applied");
    expect(intoHub.reduce((sum, link) => sum + link.value, 0)).toBe(84);
    const byLane = Object.fromEntries(intoHub.map((link) => [link.source, link.value]));
    expect(byLane).toEqual({ "lane:internship": 39, "lane:coop": 25, "lane:fulltime": 17, "lane:fellowship": 3 });
    const reached = (id: string) =>
      flow.links.filter((link) => link.target === id).reduce((sum, link) => sum + link.value, 0);
    expect([reached("stage:assessment"), reached("stage:screen"), reached("stage:interview"), reached("stage:offer")]).toEqual([15, 12, 8, 2]);
  });

  it("builds the rows from the entries", () => {
    expect(AARON_MOCK.rows).toEqual(AARON_ENTRIES.map((entry) => entry.row));
  });

  it("returns a one-lane flow without lane nodes when lanes is false", () => {
    const flow = aaronFlow({ lanes: false });
    expect(flow.nodes.some((node) => node.kind === "lane")).toBe(false);
    const columnZero = flow.nodes.filter((node) => node.column === 0);
    expect(columnZero.map((node) => node.id)).toEqual(["stage:applied"]);
    const leaving = flow.links.filter((link) => link.source === "stage:applied").reduce((sum, link) => sum + link.value, 0);
    expect(leaving).toBe(AARON_ENTRIES.length);
    expect(aaronFlow().nodes.filter((node) => node.kind === "lane")).toHaveLength(4);
  });
});
