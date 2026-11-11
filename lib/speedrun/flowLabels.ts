import type { PlacedNode } from "./flowLayout";

// Where each flow-chart label sits, in the chart's own units. Pure, so the tests can run it on real layouts.
export const FONT = 12;
export const ASCENT = 12;
export const DESCENT = 3;
/** Baseline step from a label to its value line (the tall chart stacks the two). */
export const VALUE_LINE = 14;
/** The gap between a label and its value on one line (the wide charts). */
export const VALUE_GAP = 5;
/** The outline's stroke width. paint-order puts it under the fill, so half of it shows past the glyphs. */
export const OUTLINE_WIDTH = 4;
/** How far the outline reaches past the glyphs. */
export const BACKING = OUTLINE_WIDTH / 2;
/** The reach the layout still keeps clear around a label (the old filter's 3), so thinning the outline moved nothing. */
export const CLEARANCE = 3;
/** The drawn thickness of a node bar in the tall chart. */
export const BAR = 6;
/** A lane label sits this far left of its bar, and its baseline this far under the bar's middle. */
const LANE_GAP = 8;
const LANE_BASELINE = 4;
/** A label above its bar has its baseline this far over it. */
export const LABEL_RISE = 7;
/** A label below its bar has its baseline this far under it. */
export const LABEL_DROP = 16;
/** Space needed between stacked bars so a label (and its outline) above one never reaches the bar over it, plus 2 of air. */
export const LABEL_ROOM = LABEL_RISE + ASCENT + CLEARANCE + 2;
/** Room the tall chart needs under a bar for its two-line label and the backing, before the ribbon starts. */
export const TALL_ROOM = BAR + LABEL_DROP + VALUE_LINE + DESCENT + CLEARANCE;

type LabelContext = { vertical: boolean; compact: boolean; lastColumn: number; nodeWidth: number };
type LabelSpot = { x: number; y: number; anchor: "start" | "end"; stacked: boolean };

/** The narrow hero has no room for the last two columns' exit labels and drops the last stage's label below its bar. Null means no label. */
export function placeLabel(node: PlacedNode, ctx: LabelContext): LabelSpot | null {
  if (ctx.vertical) return { x: node.x, y: node.y + BAR + LABEL_DROP, anchor: "start", stacked: true };
  const lane = node.kind === "lane";
  const atEnd = node.column === ctx.lastColumn && !lane;
  if (ctx.compact && node.kind === "exit" && node.column >= ctx.lastColumn - 1) return null;
  if (lane) return { x: node.x - LANE_GAP, y: node.y + node.h / 2 + LANE_BASELINE, anchor: "end", stacked: false };
  const y = ctx.compact && atEnd ? node.y + node.h + LABEL_DROP : node.y - LABEL_RISE;
  return { x: atEnd ? node.x + ctx.nodeWidth : node.x, y, anchor: atEnd ? "end" : "start", stacked: false };
}

/** The vertical extent of a label's backing, top and bottom. */
export function backingSpan(spot: LabelSpot): { top: number; bottom: number } {
  return { top: spot.y - ASCENT - BACKING, bottom: spot.y + DESCENT + BACKING + (spot.stacked ? VALUE_LINE : 0) };
}
