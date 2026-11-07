import { useId } from "react";
import { speedrunCopy } from "@/lib/content";
import type { FlowData, FlowLink } from "@/lib/speedrun/funnel";
import { layoutFlow } from "@/lib/speedrun/flowLayout";
import { FlowReveal } from "./FlowReveal";

// The shared flow chart. "aaron" reads the site's tokens (the --flow-* set);
// "speedrun" reads the --sr-* tokens, so it only looks right inside [data-speedrun].

const SIZE = { width: 960, height: 340, nodeWidth: 14, gap: 20 };
const TOP = 26;
const BOTTOM = 6;

const TONES = {
  aaron: {
    link: { flow: "var(--flow-link)", open: "var(--flow-open)", rejected: "var(--flow-rejected)", noreply: "var(--flow-noreply)" },
    node: "var(--flow-node)",
    text: "var(--color-foreground)",
    subtext: "var(--color-muted)",
  },
  speedrun: {
    link: {
      flow: "color-mix(in srgb, var(--sr-aqua) 80%, transparent)",
      open: "color-mix(in srgb, var(--sr-aqua) 40%, transparent)",
      rejected: "color-mix(in srgb, var(--sr-purple) 70%, transparent)",
      noreply: "var(--sr-sec)",
    },
    node: "var(--sr-ink)",
    text: "var(--sr-ink)",
    subtext: "var(--sr-ink-2)",
  },
} as const;

type Props = { data: FlowData; tone: "aaron" | "speedrun"; title: string; animate?: boolean };

export function FlowChart({ data, tone, title, animate = false }: Props) {
  const titleId = useId();
  const { nodes, links } = layoutFlow(data, SIZE);
  const colors = TONES[tone];
  const head = speedrunCopy.flow.tableHead;
  const count = (id: string) => {
    const into = data.links.filter((l: FlowLink) => l.target === id).reduce((s, l) => s + l.value, 0);
    const out = data.links.filter((l: FlowLink) => l.source === id).reduce((s, l) => s + l.value, 0);
    return Math.max(into, out);
  };
  const lastColumn = Math.max(...nodes.map((n) => n.column), 0);

  const chart = (
    <div className="overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
      <svg
        viewBox={`0 0 ${SIZE.width} ${SIZE.height + TOP + BOTTOM}`}
        role="img"
        aria-labelledby={titleId}
        className="block h-auto min-w-[680px] w-full"
      >
        <title id={titleId}>{title}</title>
        <g transform={`translate(0 ${TOP})`}>
          {links.map((link) => (
            <path
              key={`${link.source}>${link.target}`}
              className="flow-link"
              d={link.path}
              pathLength={1}
              fill="none"
              stroke={colors.link[link.tone]}
              strokeWidth={link.width}
            />
          ))}
          {nodes.map((node) => {
            const atEnd = node.column === lastColumn && node.column !== 0;
            return (
              <g key={node.id}>
                <rect x={node.x} y={node.y} width={SIZE.nodeWidth} height={node.h} rx={2} fill={colors.node} />
                <text
                  x={atEnd ? node.x + SIZE.nodeWidth : node.x}
                  y={node.y - 7}
                  textAnchor={atEnd ? "end" : "start"}
                  fontSize={12}
                  fill={colors.text}
                  aria-hidden="true"
                >
                  {node.label}
                  <tspan dx={5} fill={colors.subtext}>
                    {count(node.id)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{head.step}</th>
            <th scope="col">{head.count}</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.id}>
              <th scope="row">{node.label}</th>
              <td>{count(node.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return animate ? <FlowReveal>{chart}</FlowReveal> : chart;
}
