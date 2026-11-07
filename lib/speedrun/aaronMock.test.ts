import { describe, expect, it } from "vitest";
import { AARON_MOCK, aaronFlow } from "./aaronMock";
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
    expect(AARON_MOCK.stats.applied).toBe(84);
  });

  it("flows from four lanes through the stages", () => {
    const flow = aaronFlow();
    expect(flow.links.length).toBeGreaterThanOrEqual(8);
    const lanes = flow.nodes.filter((node) => node.kind === "lane");
    expect(lanes.map((node) => node.id).sort()).toEqual(
      ["lane:coop", "lane:fellowship", "lane:fulltime", "lane:internship"].sort(),
    );
    const intoHub = flow.links.filter((link) => link.target === "hub");
    expect(intoHub.reduce((sum, link) => sum + link.value, 0)).toBe(84);
    const byLane = Object.fromEntries(intoHub.map((link) => [link.source, link.value]));
    expect(byLane).toEqual({ "lane:internship": 39, "lane:coop": 25, "lane:fulltime": 17, "lane:fellowship": 3 });
    const reached = (id: string) =>
      flow.links.filter((link) => link.target === id).reduce((sum, link) => sum + link.value, 0);
    expect([reached("stage:assessment"), reached("stage:screen"), reached("stage:interview"), reached("stage:offer")]).toEqual([15, 12, 8, 2]);
  });
});
