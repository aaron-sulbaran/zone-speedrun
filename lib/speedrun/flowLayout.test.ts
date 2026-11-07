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

  it("conserves flow and keeps every ribbon end inside its node, in both orientations", () => {
    for (const orientation of ["horizontal", "vertical"] as const) {
      const vertical = orientation === "vertical";
      const laid = layoutFlow(data, { ...size, ...(vertical ? tall : {}) });
      const byId = new Map(laid.nodes.map((n) => [n.id, n]));
      const extent = (n: (typeof laid.nodes)[number]) => (vertical ? n.w : n.h);
      const start = (n: (typeof laid.nodes)[number]) => (vertical ? n.x : n.y);
      for (const node of laid.nodes) {
        const incoming = laid.links.filter((l) => l.target === node.id);
        const outgoing = laid.links.filter((l) => l.source === node.id);
        const sum = (links: typeof incoming) => links.reduce((s, l) => s + l.width, 0);
        if (incoming.length) expect(Math.abs(extent(node) - sum(incoming))).toBeLessThanOrEqual(0.01 * incoming.length + 0.01);
        if (outgoing.length) expect(Math.abs(extent(node) - sum(outgoing))).toBeLessThanOrEqual(0.01 * outgoing.length + 0.01);
      }
      for (const link of laid.links) {
        const numbers = (link.path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        expect(numbers).toHaveLength(8);
        // Points are "x y" horizontally and "cross main" (so x y) vertically: the cross axis is y or x.
        const crossAt = (pair: number) => numbers[pair * 2 + (vertical ? 0 : 1)];
        const ends = [
          { center: crossAt(0), node: byId.get(link.source)! },
          { center: crossAt(3), node: byId.get(link.target)! },
        ];
        for (const { center, node } of ends) {
          expect(center - link.width / 2).toBeGreaterThanOrEqual(start(node) - 0.01);
          expect(center + link.width / 2).toBeLessThanOrEqual(start(node) + extent(node) + 0.01);
        }
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
