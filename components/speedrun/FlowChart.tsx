import { useId } from "react";
import { speedrunCopy } from "@/lib/content";
import type { FlowData } from "@/lib/speedrun/funnel";
import { layoutFlow, type FlowSize, type PlacedNode } from "@/lib/speedrun/flowLayout";
import { FlowReveal } from "./FlowReveal";
import { TONES, type Tone } from "./flowTones";

// The shared flow chart. "aaron" reads the site's tokens (the --flow-* set);
// "speedrun" reads the --sr-* tokens, so it only looks right inside [data-speedrun].
// Both orientations are rendered and CSS shows one: columns across from lg up,
// rows stacked top to bottom below it, so there is no sideways scroll on phones.

const WIDE = { width: 864, height: 340, nodeWidth: 6, gap: 20, maxPerUnit: 14 } satisfies FlowSize;
const WIDE_LEFT = 100;
const WIDE_LEFT_NO_LANE = 8;
const WIDE_TOP = 26;
const TALL = { width: 340, height: 600, nodeWidth: 36, gap: 52, maxPerUnit: 12, orientation: "vertical" } satisfies FlowSize;
const TALL_RIGHT = 64;
const BAR = 6;

type Props = { data: FlowData; tone: Tone; title: string; animate?: boolean; size?: "full" | "hero" };

// The hero draws one horizontal chart per breakpoint: wide from lg, narrow below it.
const HERO_WIDE = { width: 560, height: 300, nodeWidth: 6, gap: 14, maxPerUnit: 14 };
const HERO_NARROW = { width: 360, height: 200, nodeWidth: 6, gap: 9, maxPerUnit: 14 };
const HERO_LEFT = 8;
const HERO_RIGHT = 8;

type Layout = {
  size: FlowSize;
  view: string;
  offset: { x: number; y: number } | null;
  className: string;
  hero: boolean;
  /** The narrow hero has no room for the last two columns' exit labels, and drops the last stage's label below its bar. */
  compact: boolean;
};

function layoutFor(kind: "wide" | "tall" | "heroWide" | "heroNarrow", lanes: boolean): Layout {
  if (kind === "tall") {
    return { size: TALL, view: `0 0 ${TALL.width + TALL_RIGHT} ${TALL.height}`, offset: null, className: "mx-auto block h-auto w-full max-w-[26rem] lg:hidden", hero: false, compact: false };
  }
  if (kind === "wide") {
    const left = lanes ? WIDE_LEFT : WIDE_LEFT_NO_LANE;
    return { size: WIDE, view: `0 0 ${left + WIDE.width} ${WIDE.height + WIDE_TOP + 6}`, offset: { x: left, y: WIDE_TOP }, className: "hidden h-auto w-full lg:block", hero: false, compact: false };
  }
  const box = kind === "heroWide" ? HERO_WIDE : HERO_NARROW;
  const size = { ...box, width: box.width - HERO_LEFT - HERO_RIGHT, height: box.height - WIDE_TOP - 6 };
  return {
    size,
    view: `0 0 ${box.width} ${box.height}`,
    offset: { x: HERO_LEFT, y: WIDE_TOP },
    className: kind === "heroWide" ? "hidden h-auto w-full lg:block" : "mx-auto block h-auto w-full lg:hidden",
    hero: true,
    compact: kind === "heroNarrow",
  };
}

function Svg({ data, tone, title, kind }: { data: FlowData; tone: Tone; title: string; kind: "wide" | "tall" | "heroWide" | "heroNarrow" }) {
  const titleId = useId();
  const colors = TONES[tone];
  const vertical = kind === "tall";
  const hasLanes = data.nodes.some((n) => n.kind === "lane");
  const layout = layoutFor(kind, hasLanes);
  const { nodes, links } = layoutFlow(data, layout.size);
  const lastColumn = Math.max(...nodes.map((n) => n.column), 0);
  const nodeWidth = layout.size.nodeWidth;
  const halo = { stroke: colors.halo, strokeWidth: 4, paintOrder: "stroke" } as const;

  const label = (node: PlacedNode) => {
    // The hero's applied count is the number the intro flies in from the subtitle.
    const sourceValue = layout.hero && node.id === "stage:applied" ? { "data-flow-source-value": "" } : {};
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
    const lane = node.kind === "lane";
    const atEnd = node.column === lastColumn && !lane;
    if (layout.compact && node.kind === "exit" && node.column >= lastColumn - 1) return null;
    const below = layout.compact && atEnd;
    return (
      <text
        x={lane ? node.x - 8 : atEnd ? node.x + nodeWidth : node.x}
        y={lane ? node.y + node.h / 2 + 4 : below ? node.y + node.h + 13 : node.y - 7}
        textAnchor={lane || atEnd ? "end" : "start"}
        fontSize={12}
        fill={colors.text}
        aria-hidden="true"
        {...(lane ? {} : halo)}
      >
        {node.label}
        <tspan dx={5} fill={colors.subtext} {...sourceValue}>
          {node.value}
        </tspan>
      </text>
    );
  };

  return (
    <svg viewBox={layout.view} role="img" aria-labelledby={titleId} className={layout.className}>
      <title id={titleId}>{title}</title>
      <g transform={layout.offset ? `translate(${layout.offset.x} ${layout.offset.y})` : undefined}>
        <g {...(layout.hero ? { "data-flow-links": "" } : {})}>
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
        </g>
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

export function FlowChart({ data, tone, title, animate = false, size = "full" }: Props) {
  const kinds = size === "hero" ? (["heroWide", "heroNarrow"] as const) : (["wide", "tall"] as const);
  const chart = (
    <div>
      {/* Both layouts render on purpose and CSS shows one, so the duplicate titles are expected. */}
      {kinds.map((kind) => (
        <Svg key={kind} data={data} tone={tone} title={title} kind={kind} />
      ))}
      <CountsTable data={data} />
    </div>
  );
  return animate ? <FlowReveal>{chart}</FlowReveal> : chart;
}
