import { describe, expect, it } from "vitest";
import { aaronFlow } from "./aaronMock";
import { ASCENT, BACKING, BAR, DESCENT, OUTLINE_WIDTH, LABEL_DROP, LABEL_RISE, LABEL_ROOM, TALL_ROOM, VALUE_LINE, backingSpan, placeLabel } from "./flowLabels";
import { layoutFlow, type PlacedNode } from "./flowLayout";
import { HERO_NARROW, HERO_WIDE, TALL, WIDE } from "./flowSizes";

const flows = [aaronFlow(), aaronFlow({ lanes: false })];

describe("label room", () => {
  // Catches: BACKING drifting from the outline's real outset (half of its 4 wide stroke), which placement and collision maths read.
  it("BACKING is the outline's outset", () => {
    expect(OUTLINE_WIDTH).toBe(4);
    expect(BACKING).toBe(2);
  });

  // Catches: LABEL_ROOM shrunk until a label's backing reaches the bar above it.
  it("covers the rise, the glyph height and the backing", () => {
    expect(LABEL_ROOM).toBeGreaterThanOrEqual(LABEL_RISE + ASCENT + BACKING);
    expect(LABEL_ROOM).toBeGreaterThanOrEqual(22);
  });

  // Catches: a size whose gap was set by hand below the room labels need.
  it("is what every horizontal size keeps between stacked bars", () => {
    for (const size of [WIDE, HERO_WIDE, HERO_NARROW]) expect(size.gap).toBeGreaterThanOrEqual(LABEL_ROOM);
  });

  // Catches: the tall bars too thin for the label and value under them (the last row was clipped, ribbons started under the text).
  it("is what the tall chart's bars are thick enough to hold under the bar", () => {
    expect(TALL_ROOM).toBeGreaterThanOrEqual(BAR + LABEL_DROP + VALUE_LINE + DESCENT + BACKING);
    expect(TALL.nodeWidth).toBeGreaterThanOrEqual(TALL_ROOM);
  });
});

describe("placed labels on real layouts", () => {
  const ctxFor = (nodes: PlacedNode[], nodeWidth: number, over: { vertical?: boolean; compact?: boolean } = {}) => ({
    vertical: false,
    compact: false,
    lastColumn: Math.max(...nodes.map((n) => n.column)),
    nodeWidth,
    ...over,
  });

  for (const [name, size, compact] of [["wide", WIDE, false], ["hero wide", HERO_WIDE, false], ["hero narrow", HERO_NARROW, true]] as const) {
    it(`${name}: no label's backing reaches the bar above it`, () => {
      for (const flow of flows) {
        const { nodes } = layoutFlow(flow, size);
        const ctx = ctxFor(nodes, size.nodeWidth, { compact });
        const columns = new Map<number, PlacedNode[]>();
        for (const node of nodes) columns.set(node.column, [...(columns.get(node.column) ?? []), node]);
        for (const stack of columns.values()) {
          const sorted = [...stack].sort((a, b) => a.y - b.y);
          sorted.forEach((node, index) => {
            const spot = placeLabel(node, ctx);
            const above = sorted[index - 1];
            if (!spot || !above || node.kind === "lane" || spot.y > node.y) return;
            expect(backingSpan(spot).top).toBeGreaterThanOrEqual(above.y + above.h);
          });
        }
      }
    });
  }

  // Catches: LABEL_RISE or LABEL_DROP lowered until a label's backing touches the bar it names.
  it("every label's backing clears its own bar by at least a pixel", () => {
    const sizes = [["wide", WIDE, false, false], ["hero wide", HERO_WIDE, false, false], ["hero narrow", HERO_NARROW, true, false], ["tall", TALL, false, true]] as const;
    for (const [, size, compact, vertical] of sizes) {
      for (const flow of flows) {
        const { nodes } = layoutFlow(flow, size);
        const ctx = ctxFor(nodes, size.nodeWidth, { compact, vertical });
        for (const node of nodes) {
          const spot = placeLabel(node, ctx);
          if (!spot || node.kind === "lane") continue;
          const span = backingSpan(spot);
          const barBottom = node.y + (vertical ? BAR : node.h);
          if (spot.y > node.y) expect(span.top).toBeGreaterThanOrEqual(barBottom + 1);
          else expect(span.bottom).toBeLessThanOrEqual(node.y - 1);
        }
      }
    }
  });

  // Catches: the last row's value line cut by the viewBox, and ribbons starting under their label.
  it("tall: the backing ends before the ribbon starts and inside the chart", () => {
    for (const flow of flows) {
      const { nodes } = layoutFlow(flow, TALL);
      const ctx = ctxFor(nodes, TALL.nodeWidth, { vertical: true });
      for (const node of nodes) {
        const spot = placeLabel(node, ctx)!;
        expect(backingSpan(spot).bottom).toBeLessThanOrEqual(node.y + TALL.nodeWidth);
        expect(backingSpan(spot).bottom).toBeLessThanOrEqual(TALL.height);
      }
    }
  });

  it("the narrow hero draws no exit label in its last two columns", () => {
    const { nodes } = layoutFlow(flows[1], HERO_NARROW);
    const ctx = ctxFor(nodes, 6, { compact: true });
    const hidden = nodes.filter((n) => n.kind === "exit" && n.column >= ctx.lastColumn - 1);
    expect(hidden.length).toBeGreaterThan(0);
    for (const node of hidden) expect(placeLabel(node, ctx)).toBeNull();
  });
});
