import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import { slotsFor } from "./actions";
import { whenLabel } from "./when";

describe("whenLabel", () => {
  // Catches: the time format growing a zone ("3:00 PM UTC") for a made-up time, which the exact-match e2e pin would follow.
  it("reads a time as day, date and a lower-case clock, with no zone", () => {
    expect(whenLabel("2026-11-16T15:00:00.000Z")).toBe("Mon, Nov 16, 3:00\u00a0pm");
    expect(whenLabel("2026-11-16T09:05:00.000Z")).toBe("Mon, Nov 16, 9:05\u00a0am");
  });

  // Catches: a booked call's time splitting from its am/pm across two lines in a narrow column (M5): no ordinary space may sit before it.
  it("keeps the time and its am or pm together with a no-break space", () => {
    expect(whenLabel("2026-11-16T15:00:00.000Z")).not.toMatch(/\d:\d\d (am|pm)/);
    // Catches: an offered slot (built by the same clock) splitting from its am or pm.
    expect(slotsFor("2026-11-07").every((slot) => !/\d:\d\d (am|pm)/.test(slot))).toBe(true);
  });

  // Catches: the offered slots and a booked call reading in two different formats.
  it("words an offered slot the way it words a booked call", () => {
    const [first] = slotsFor("2026-11-07");
    expect(first).toBe(whenLabel("2026-11-09T10:00:00.000Z"));
  });

  // Catches: the brief's send time splitting from its am across two lines in an inbox row.
  it("keeps the brief's send time together too", () => {
    expect(speedrunCopy.brief.time).not.toMatch(/\d (am|pm)/);
    // Catches: the heading's copy of the same time using an ordinary space.
    expect(speedrunCopy.brief.heading).not.toMatch(/\d (am|pm)/);
  });
});
