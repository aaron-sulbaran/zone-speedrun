import { describe, expect, it } from "vitest";
import { aaronFlow } from "./aaronMock";
import { layoutFlow } from "./flowLayout";

const size = { width: 960, height: 360, nodeWidth: 6, gap: 18 };
const tall = { width: 360, height: 560, nodeWidth: 6, gap: 40, orientation: "vertical" as const };

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

  it("conserves flow: a node's extent is the sum of its link widths on each side, and slots stay inside it", () => {
    for (const orientation of ["horizontal", "vertical"] as const) {
      const laid = layoutFlow(data, { ...size, ...(orientation === "vertical" ? tall : {}) });
      const extent = (n: (typeof laid.nodes)[number]) => (orientation === "vertical" ? n.w : n.h);
      for (const node of laid.nodes) {
        const incoming = laid.links.filter((l) => l.target === node.id).reduce((s, l) => s + l.width, 0);
        const outgoing = laid.links.filter((l) => l.source === node.id).reduce((s, l) => s + l.width, 0);
        const slack = 0.1 * laid.links.length;
        if (incoming > 0) expect(Math.abs(extent(node) - incoming)).toBeLessThan(slack);
        if (outgoing > 0) expect(Math.abs(extent(node) - outgoing)).toBeLessThan(slack);
        expect(Math.max(incoming, outgoing)).toBeLessThanOrEqual(extent(node) + slack);
      }
    }
  });

  it("stacks columns as rows when vertical, with no overlap and inside the box", () => {
    const laid = layoutFlow(data, tall);
    const rows = new Map<number, typeof laid.nodes>();
    for (const node of laid.nodes) rows.set(node.column, [...(rows.get(node.column) ?? []), node]);
    expect(new Set(laid.nodes.map((n) => n.y)).size).toBe(rows.size);
    for (const nodes of rows.values()) {
      const sorted = [...nodes].sort((a, b) => a.x - b.x);
      sorted.forEach((node, index) => {
        expect(node.x).toBeGreaterThanOrEqual(-0.001);
        expect(node.x + node.w).toBeLessThanOrEqual(tall.width + 0.001);
        const next = sorted[index + 1];
        if (next) expect(next.x - (node.x + node.w)).toBeGreaterThanOrEqual(tall.gap - 0.05);
      });
    }
  });

  it("caps pixels per application so a small flow stays slim", () => {
    const small = { nodes: data.nodes.slice(0, 2), links: [{ source: data.nodes[0].id, target: data.nodes[1].id, value: 3, tone: "flow" as const }] };
    const laid = layoutFlow(small, { ...size, maxPerUnit: 10 });
    expect(laid.links[0].width).toBeCloseTo(30, 1);
  });

  it("falls back to zero scale rather than NaN when nothing fits", () => {
    const laid = layoutFlow(data, { ...size, height: 10 });
    for (const link of laid.links) expect(link.width).toBe(0);
  });
});
