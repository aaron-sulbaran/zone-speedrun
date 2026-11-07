import { useId } from "react";
import { speedrunCopy } from "@/lib/content";
import type { FlowData } from "@/lib/speedrun/funnel";
import { layoutFlow, type FlowSize, type PlacedNode } from "@/lib/speedrun/flowLayout";
import { FlowReveal } from "./FlowReveal";

// The shared flow chart. "aaron" reads the site's tokens (the --flow-* set);
// "speedrun" reads the --sr-* tokens, so it only looks right inside [data-speedrun].
// Both orientations are rendered and CSS shows one: columns across from lg up,
// rows stacked top to bottom below it, so there is no sideways scroll on phones.

const WIDE = { width: 864, height: 340, nodeWidth: 6, gap: 20, maxPerUnit: 14 } satisfies FlowSize;
const WIDE_LEFT = 100;
const WIDE_TOP = 26;
const TALL = { width: 340, height: 600, nodeWidth: 36, gap: 52, maxPerUnit: 12, orientation: "vertical" } satisfies FlowSize;
const TALL_RIGHT = 64;
const BAR = 6;

const TONES = {
  aaron: {
    link: { flow: "var(--flow-link)", open: "var(--flow-open)", rejected: "var(--flow-rejected)", noreply: "var(--flow-noreply)" },
    node: "var(--color-accent)",
    text: "var(--color-foreground)",
    subtext: "var(--color-muted)",
    halo: "var(--color-background)",
  },
  speedrun: {
    link: {
      flow: "color-mix(in srgb, var(--sr-ink) 70%, transparent)",
      open: "color-mix(in srgb, var(--sr-ink) 30%, transparent)",
      rejected: "var(--sr-purple)",
      noreply: "var(--sr-sec)",
    },
    node: "var(--sr-ink)",
    text: "var(--sr-ink)",
    subtext: "var(--sr-ink-2)",
    halo: "var(--sr-bg)",
  },
} as const;

type Tone = keyof typeof TONES;
type Props = { data: FlowData; tone: Tone; title: string; animate?: boolean };

function Svg({ data, tone, title, vertical }: { data: FlowData; tone: Tone; title: string; vertical: boolean }) {
  const titleId = useId();
  const colors = TONES[tone];
  const { nodes, links } = layoutFlow(data, vertical ? TALL : WIDE);
  const lastColumn = Math.max(...nodes.map((n) => n.column), 0);
  const view = vertical ? `0 0 ${TALL.width + TALL_RIGHT} ${TALL.height}` : `0 0 ${WIDE_LEFT + WIDE.width} ${WIDE.height + WIDE_TOP + 6}`;
  const halo = { stroke: colors.halo, strokeWidth: 4, paintOrder: "stroke" } as const;

  const label = (node: PlacedNode) => {
    if (vertical) {
      return (
        <text x={node.x} y={node.y + BAR + 13} fontSize={12} fill={colors.text} aria-hidden="true">
          {node.label}
          <tspan x={node.x} dy={14} fill={colors.subtext}>
            {node.value}
          </tspan>
        </text>
      );
    }
    const lane = node.column === 0;
    const atEnd = node.column === lastColumn && !lane;
    return (
      <text
        x={lane ? node.x - 8 : atEnd ? node.x + WIDE.nodeWidth : node.x}
        y={lane ? node.y + node.h / 2 + 4 : node.y - 7}
        textAnchor={lane || atEnd ? "end" : "start"}
        fontSize={12}
        fill={colors.text}
        aria-hidden="true"
        {...(lane ? {} : halo)}
      >
        {node.label}
        <tspan dx={5} fill={colors.subtext}>
          {node.value}
        </tspan>
      </text>
    );
  };

  return (
    <svg
      viewBox={view}
      role="img"
      aria-labelledby={titleId}
      className={vertical ? "mx-auto block h-auto w-full max-w-[26rem] lg:hidden" : "hidden h-auto w-full lg:block"}
    >
      <title id={titleId}>{title}</title>
      <g transform={vertical ? undefined : `translate(${WIDE_LEFT} ${WIDE_TOP})`}>
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
        {nodes.map((node) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={node.w} height={vertical ? BAR : node.h} rx={1.5} fill={colors.node} />
            {label(node)}
          </g>
        ))}
      </g>
    </svg>
  );
}

function CountsTable({ data }: { data: FlowData }) {
  const head = speedrunCopy.flow.tableHead;
  const exits = speedrunCopy.flow.exits;
  const value = (id: string) => {
    const into = data.links.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0);
    const out = data.links.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0);
    return Math.max(into, out);
  };
  const stages = data.nodes.filter((n) => n.kind === "stage").sort((a, b) => a.column - b.column);
  const lanes = data.nodes.filter((n) => n.kind === "lane");
  const exitCount = (stage: string, exit: string) => {
    const node = data.nodes.find((n) => n.id === `exit:${exit}:${stage}`);
    return node ? value(node.id) : 0;
  };
  return (
    <div className="sr-only">
      <table>
        <caption>{speedrunCopy.flow.tableCaptions.stages}</caption>
        <thead>
          <tr>
            <th scope="col">{head.stage}</th>
            <th scope="col">{head.reached}</th>
            <th scope="col">{exits.rejected}</th>
            <th scope="col">{exits.noreply}</th>
            <th scope="col">{exits.open}</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage) => {
            const key = stage.id.replace("stage:", "");
            return (
              <tr key={stage.id}>
                <th scope="row">{stage.label}</th>
                <td>{value(stage.id)}</td>
                <td>{exitCount(key, "rejected")}</td>
                <td>{exitCount(key, "noreply")}</td>
                <td>{exitCount(key, "open")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <table>
        <caption>{speedrunCopy.flow.tableCaptions.tracks}</caption>
        <thead>
          <tr>
            <th scope="col">{head.track}</th>
            <th scope="col">{head.count}</th>
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.id}>
              <th scope="row">{lane.label}</th>
              <td>{value(lane.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlowChart({ data, tone, title, animate = false }: Props) {
  const chart = (
    <div>
      <Svg data={data} tone={tone} title={title} vertical={false} />
      <Svg data={data} tone={tone} title={title} vertical />
      <CountsTable data={data} />
    </div>
  );
  return animate ? <FlowReveal>{chart}</FlowReveal> : chart;
}
