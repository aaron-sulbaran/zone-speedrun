import { describe, expect, it } from "vitest";
import { HERO_NARROW, HERO_WIDE, LABEL_DROP, LABEL_ROOM, TALL, WIDE } from "./flowSizes";

// Catches: a stacked node's label (drawn above its bar) running into the bar above it.
describe("flow sizes", () => {
  it("leave room between stacked bars for the label above each one", () => {
    for (const size of [WIDE, HERO_WIDE, HERO_NARROW]) expect(size.gap).toBeGreaterThanOrEqual(LABEL_ROOM);
  });

  it("keep the tall chart's gap wide enough for its two-line label under each bar", () => {
    expect(TALL.gap).toBeGreaterThanOrEqual(6 + LABEL_DROP + 14);
  });
});
