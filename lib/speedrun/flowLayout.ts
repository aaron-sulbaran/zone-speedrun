import type { FlowData, FlowLink, FlowNode } from "./funnel";

export type FlowSize = { width: number; height: number; nodeWidth: number; gap: number };
export type PlacedNode = FlowNode & { x: number; y: number; h: number };
export type PlacedLink = FlowLink & { path: string; width: number };

const num = (value: number) => Number(value.toFixed(2));

/**
 * Pure flow layout. Columns are spaced evenly, a node's height is its
 * throughput times one shared scale, nodes in a column stack with `gap` and the
 * stack is centered. Each link is the centerline of a ribbon (a cubic bezier)
 * whose stroke width is `width`; the ribbon runs between the slots it takes on
 * its source and target nodes.
 */
export function layoutFlow(data: FlowData, size: FlowSize): { nodes: PlacedNode[]; links: PlacedLink[] } {
  if (data.nodes.length === 0) return { nodes: [], links: [] };
  const { width, height, nodeWidth, gap } = size;

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

  let scale = Infinity;
  for (const nodes of columns.values()) {
    const total = nodes.reduce((s, n) => s + (through.get(n.id) ?? 0), 0);
    scale = Math.min(scale, (height - gap * (nodes.length - 1)) / total);
  }

  const maxColumn = Math.max(...columns.keys());
  const step = maxColumn === 0 ? 0 : (width - nodeWidth) / maxColumn;
  const placed = new Map<string, PlacedNode>();
  for (const [column, nodes] of columns) {
    const stack = nodes.reduce((s, n) => s + (through.get(n.id) ?? 0) * scale, 0) + gap * (nodes.length - 1);
    let y = (height - stack) / 2;
    for (const node of nodes) {
      const h = (through.get(node.id) ?? 0) * scale;
      placed.set(node.id, { ...node, x: num(column * step), y: num(y), h: num(h) });
      y += h + gap;
    }
  }

  const index = new Map(data.links.map((link, i) => [link, i]));
  const sourceOffset = new Map<FlowLink, number>();
  const targetOffset = new Map<FlowLink, number>();
  for (const node of data.nodes) {
    const here = placed.get(node.id) as PlacedNode;
    const slots = (links: FlowLink[], other: (l: FlowLink) => string, into: Map<FlowLink, number>) => {
      let offset = 0;
      [...links]
        .sort((a, b) => (placed.get(other(a)) as PlacedNode).y - (placed.get(other(b)) as PlacedNode).y || (index.get(a) ?? 0) - (index.get(b) ?? 0))
        .forEach((link) => {
          into.set(link, here.y + offset);
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
    const x0 = from.x + nodeWidth;
    const x1 = to.x;
    const y0 = (sourceOffset.get(link) as number) + w / 2;
    const y1 = (targetOffset.get(link) as number) + w / 2;
    const mid = (x0 + x1) / 2;
    return { ...link, width: num(w), path: `M${num(x0)} ${num(y0)}C${num(mid)} ${num(y0)},${num(mid)} ${num(y1)},${num(x1)} ${num(y1)}` };
  });

  return { nodes: [...placed.values()], links };
}
