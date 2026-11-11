import type { FlowSize } from "./flowLayout";

// The flow chart's sizes. Labels of non-lane nodes sit LABEL_RISE above their bar, so a column's
// gap must leave LABEL_ROOM for them or a label runs into the bar above it.
export const LABEL_RISE = 6;
// A label drawn below its bar (the tall chart, the narrow hero's last column) has its baseline LABEL_DROP under the bar.
export const LABEL_DROP = 16;
export const LABEL_ROOM = 22;

export const WIDE = { width: 864, height: 340, nodeWidth: 6, gap: LABEL_ROOM, maxPerUnit: 14 } satisfies FlowSize;
export const TALL = { width: 340, height: 600, nodeWidth: 36, gap: 52, maxPerUnit: 12, orientation: "vertical" } satisfies FlowSize;
// The hero draws one horizontal chart per breakpoint: wide from lg, narrow below it.
export const HERO_WIDE = { width: 560, height: 300, nodeWidth: 6, gap: LABEL_ROOM, maxPerUnit: 14 };
export const HERO_NARROW = { width: 360, height: 200, nodeWidth: 6, gap: LABEL_ROOM, maxPerUnit: 14 };
