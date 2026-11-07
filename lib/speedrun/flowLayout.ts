import type { FlowData, FlowLink, FlowNode } from "./funnel";

export type FlowSize = {
  width: number;
  height: number;
  /** Thickness of a node bar along the flow. */
  nodeWidth: number;
  /** Space between nodes stacked in one column (or row, when vertical). */
  gap: number;
  /** Columns run left to right (default) or become rows running top to bottom. */
  orientation?: "horizontal" | "vertical";
  /** Most pixels one application may take, so a small flow is not a slab. */
  maxPerUnit?: number;
};
export type PlacedNode = FlowNode & { x: number; y: number; w: number; h: number; value: number };
export type PlacedLink = FlowLink & { path: string; width: number };

const num = (value: number) => Number(value.toFixed(2));

/**
 * Pure flow layout. Columns are spaced evenly along the main axis, a node's
 * extent across it is its throughput times one shared scale, nodes in a column
 * stack with `gap` and the stack is centered. Each link is the centerline of a
 * ribbon (a cubic bezier) whose stroke width is `width`; it runs between the
 * slots it takes on its source and target nodes.
 */
export function layoutFlow(data: FlowData, size: FlowSize): { nodes: PlacedNode[]; links: PlacedLink[] } {
  if (data.nodes.length === 0) return { nodes: [], links: [] };
  const { nodeWidth, gap, maxPerUnit = Infinity } = size;
  const vertical = size.orientation === "vertical";
  const mainLength = vertical ? size.height : size.width;
  const crossLength = vertical ? size.width : size.height;

  const through = new Map<string, number>();
  for (const node of data.nodes) {
    const inSum = data.links.filter((l) => l.target === node.id).reduce((s, l) => s + l.value, 0);
    const outSum = data.links.filter((l) => l.source === node.id).reduce((s, l) => s + l.value, 0);
    through.set(node.id, Math.max(inSum, outSum));
  }

  const columns = new Map<number, FlowNode[]>();
  data.nodes.forEach((node) => columns.set(node.column, [...(columns.get(node.column) ?? []), node]));
  for (const [column, nodes] of columns) {
    const rank = (n: FlowNode) => (n.kind === "exit" ? 1 : 0);
    columns.set(
      column,
      nodes.map((n, i) => ({ n, i })).sort((a, b) => rank(a.n) - rank(b.n) || a.i - b.i).map(({ n }) => n),
    );
  }

  let scale = maxPerUnit;
  for (const nodes of columns.values()) {
    const total = nodes.reduce((s, n) => s + (through.get(n.id) ?? 0), 0);
    scale = Math.min(scale, (crossLength - gap * (nodes.length - 1)) / total);
  }
  scale = Number.isFinite(scale) ? Math.max(0, scale) : 0;

  const maxColumn = Math.max(...columns.keys());
  const step = maxColumn === 0 ? 0 : (mainLength - nodeWidth) / maxColumn;
  const placed = new Map<string, PlacedNode>();
  for (const [column, nodes] of columns) {
    const stack = nodes.reduce((s, n) => s + (through.get(n.id) ?? 0) * scale, 0) + gap * (nodes.length - 1);
    let cross = (crossLength - stack) / 2;
    for (const node of nodes) {
      const value = through.get(node.id) ?? 0;
      const extent = value * scale;
      const main = column * step;
      placed.set(node.id, {
        ...node,
        value,
        x: num(vertical ? cross : main),
        y: num(vertical ? main : cross),
        w: num(vertical ? extent : nodeWidth),
        h: num(vertical ? nodeWidth : extent),
      });
      cross += extent + gap;
    }
  }

  const crossOf = (node: PlacedNode) => (vertical ? node.x : node.y);
  const index = new Map(data.links.map((link, i) => [link, i]));
  const sourceOffset = new Map<FlowLink, number>();
  const targetOffset = new Map<FlowLink, number>();
  for (const node of data.nodes) {
    const here = placed.get(node.id) as PlacedNode;
    const slots = (links: FlowLink[], other: (l: FlowLink) => string, into: Map<FlowLink, number>) => {
      let offset = 0;
      [...links]
        .sort(
          (a, b) =>
            crossOf(placed.get(other(a)) as PlacedNode) - crossOf(placed.get(other(b)) as PlacedNode) ||
            (index.get(a) ?? 0) - (index.get(b) ?? 0),
        )
        .forEach((link) => {
          into.set(link, crossOf(here) + offset);
          offset += link.value * scale;
        });
    };
    slots(data.links.filter((l) => l.source === node.id), (l) => l.target, sourceOffset);
    slots(data.links.filter((l) => l.target === node.id), (l) => l.source, targetOffset);
  }

  const links = data.links.map((link): PlacedLink => {
    const from = placed.get(link.source) as PlacedNode;
    const to = placed.get(link.target) as PlacedNode;
    const w = link.value * scale;
    const c0 = (sourceOffset.get(link) as number) + w / 2;
    const c1 = (targetOffset.get(link) as number) + w / 2;
    const m0 = (vertical ? from.y : from.x) + nodeWidth;
    const m1 = vertical ? to.y : to.x;
    const mid = (m0 + m1) / 2;
    const point = (main: number, cross: number) => (vertical ? `${num(cross)} ${num(main)}` : `${num(main)} ${num(cross)}`);
    return {
      ...link,
      width: num(w),
      path: `M${point(m0, c0)}C${point(mid, c0)},${point(mid, c1)},${point(m1, c1)}`,
    };
  });

  return { nodes: [...placed.values()], links };
}
