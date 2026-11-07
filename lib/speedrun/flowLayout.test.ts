import { describe, expect, it } from "vitest";
import { aaronFlow } from "./aaronMock";
import { layoutFlow } from "./flowLayout";

const size = { width: 960, height: 360, nodeWidth: 14, gap: 18 };

describe("layoutFlow", () => {
  const data = aaronFlow();
  const out = layoutFlow(data, size);

  it("sizes every link in proportion to its value", () => {
    const ratios = out.links.map((link) => link.width / link.value);
    for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios[0], 1);
  });

  it("never overlaps two nodes in a column and stays inside the height", () => {
    const columns = new Map<number, typeof out.nodes>();
    for (const node of out.nodes) columns.set(node.column, [...(columns.get(node.column) ?? []), node]);
    for (const nodes of columns.values()) {
      const sorted = [...nodes].sort((a, b) => a.y - b.y);
      sorted.forEach((node, index) => {
        expect(node.y).toBeGreaterThanOrEqual(-0.001);
        expect(node.y + node.h).toBeLessThanOrEqual(size.height + 0.001);
        const next = sorted[index + 1];
        if (next) expect(next.y - (node.y + node.h)).toBeGreaterThanOrEqual(size.gap - 0.05);
      });
    }
  });

  it("is deterministic and gives each link a cubic path", () => {
    expect(layoutFlow(data, size)).toEqual(out);
    expect(out.links).toHaveLength(data.links.length);
    for (const link of out.links) expect(link.path).toMatch(/^M[\d.\- ,]+C[\d.\- ,]+$/);
  });

  it("returns nothing for an empty flow", () => {
    expect(layoutFlow({ nodes: [], links: [] }, size)).toEqual({ nodes: [], links: [] });
  });
});
