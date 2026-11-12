import { describe, expect, it } from "vitest";
import { slotsFor } from "./actions";
import { whenLabel } from "./when";

describe("whenLabel", () => {
  // Catches: the time format growing a zone ("3:00 PM UTC") for a made-up time, which the exact-match e2e pin would follow.
  it("reads a time as day, date and a lower-case clock, with no zone", () => {
    expect(whenLabel("2026-11-16T15:00:00.000Z")).toBe("Mon, Nov 16, 3:00 pm");
    expect(whenLabel("2026-11-16T09:05:00.000Z")).toBe("Mon, Nov 16, 9:05 am");
  });

  // Catches: the offered slots and a booked call reading in two different formats.
  it("words an offered slot the way it words a booked call", () => {
    const [first] = slotsFor("2026-11-07");
    expect(first).toBe(whenLabel("2026-11-09T10:00:00.000Z"));
  });
});
