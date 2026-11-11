import type { FlowSize } from "./flowLayout";
import { LABEL_ROOM, TALL_ROOM } from "./flowLabels";

// The flow chart's sizes. Stacked bars keep LABEL_ROOM apart and the tall chart's bars are TALL_ROOM
// thick (ribbons start under the label), so a label never reaches a bar or a ribbon start.
export const WIDE = { width: 864, height: 340, nodeWidth: 6, gap: LABEL_ROOM, maxPerUnit: 14 } satisfies FlowSize;
export const TALL = { width: 340, height: 600, nodeWidth: TALL_ROOM, gap: 52, maxPerUnit: 12, orientation: "vertical" } satisfies FlowSize;
// The hero draws one horizontal chart per breakpoint: wide from lg, narrow below it.
export const HERO_WIDE = { width: 560, height: 300, nodeWidth: 6, gap: LABEL_ROOM, maxPerUnit: 14 };
export const HERO_NARROW = { width: 360, height: 200, nodeWidth: 6, gap: LABEL_ROOM, maxPerUnit: 14 };
