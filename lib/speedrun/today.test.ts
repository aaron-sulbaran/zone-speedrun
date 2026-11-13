import { describe, expect, it } from "vitest";
import { slotsFor, needsYou } from "./actions";
import { classifyEmail } from "./classify";
import { detailsFor } from "./details";
import { INBOX_TODAY, generateInbox } from "./inbox";
import { PEOPLE } from "./people";
import { buildPipeline } from "./pipeline";
import { addDays, daysBetween, demoToday, meetingOn } from "./today";

const SAM_DUES = ["Wrenfield", "Lumora Health", "Cindermoor Cloud", "Quillbright"];
const YEAR = Array.from({ length: 366 }, (_, offset) => addDays(INBOX_TODAY, offset));
// Written out, not derived, so a change to the dates cannot also change what the test expects.
const SAM_ORDER = [
  "decideOffer:Wrenfield:Founding Engineer",
  "pickTime:Lumora Health:-",
  "confirmInterview:Cindermoor Cloud:Software Engineer, New Grad",
  "decideOffer:Quillbright:Software Engineer, Product",
];

describe("demoToday", () => {
  // Catches: the demo reading the UTC date (or a fixed one) instead of the visitor's local day, so a late-evening visitor sees tomorrow.
  it("is the local calendar date, whatever the hour", () => {
    expect(demoToday(new Date(2026, 11, 3, 23, 59, 30))).toBe("2026-12-03");
    expect(demoToday(new Date(2026, 0, 5, 0, 0, 1))).toBe("2026-01-05");
  });
});

describe("meetingOn", () => {
  // Catches: a made-up call landing on a weekend, which the ruling moves to the Monday after.
  it("moves a Saturday or Sunday call to the following Monday and keeps 15:00 UTC", () => {
    expect(meetingOn("2026-11-07", 0)).toBe("2026-11-09T15:00:00.000Z");
    expect(meetingOn("2026-11-07", 1)).toBe("2026-11-09T15:00:00.000Z");
    expect(meetingOn("2026-11-07", 2)).toBe("2026-11-09T15:00:00.000Z");
  });
});

describe("Sam's pinned dates follow the day", () => {
  // Catches: any due or call in Sam's pinned set falling before the visitor's today, on any day of the year (the stale-date bug), or on a weekend.
  it("never dates a due or a call before today, and no call on a weekend", () => {
    for (const day of YEAR) {
      for (const detail of Object.values(detailsFor(day).sam ?? {})) {
        if (detail.due) expect(daysBetween(day, detail.due), `${day} due ${detail.due}`).toBeGreaterThanOrEqual(0);
        if (detail.meeting) {
          expect(daysBetween(day, detail.meeting.at), `${day} call ${detail.meeting.at}`).toBeGreaterThanOrEqual(0);
          expect([0, 6]).not.toContain(new Date(detail.meeting.at).getUTCDay());
        }
      }
    }
  });

  // Catches: the four dues reordering (or two sharing a day) when the offsets move with the day, which would reshuffle the needs-you list.
  it("keeps the four dues in order, today first", () => {
    for (const day of YEAR) {
      const dues = SAM_DUES.map((company) => detailsFor(day).sam?.[company].due ?? "");
      expect(dues, day).toEqual([0, 1, 2, 3].map((offset) => addDays(day, offset)));
    }
  });

  // Catches: the needs-you list changing shape (items, order) on a later day, such as a call moving inside the week and turning a confirmation into a prepare.
  it("gives the same needs-you list on every day of a year", () => {
    for (const day of YEAR.filter((_, index) => index % 7 === 0 || index < 14)) {
      const events = generateInbox(PEOPLE.sam, 1, day).map(classifyEmail);
      const ids = needsYou(buildPipeline(events, day), detailsFor(day).sam, day).map((action) => action.id);
      expect(ids.slice(0, 4), day).toEqual(SAM_ORDER);
    }
  });
});

describe("generateInbox anchors to the day it is given", () => {
  // Catches: the inbox staying pinned to the reference day (every event keeps its date while "today" moves), or the overnight and pinned events not moving with it.
  it("gives the same events shifted by the day difference", () => {
    const later = "2026-12-03";
    const shift = daysBetween(INBOX_TODAY, later) * 86_400_000;
    for (const key of Object.keys(PEOPLE) as Array<keyof typeof PEOPLE>) {
      const base = generateInbox(PEOPLE[key]);
      const moved = generateInbox(PEOPLE[key], 1, later);
      expect(moved.map((email) => ({ ...email, date: "" }))).toEqual(base.map((email) => ({ ...email, date: "" })));
      expect(moved.map((email) => Date.parse(email.date))).toEqual(base.map((email) => Date.parse(email.date) + shift));
    }
  });
});

describe("slots", () => {
  // Catches: offered slots anchored to a fixed day instead of the day passed in.
  it("start on the next weekday after the day given", () => {
    expect(slotsFor("2026-12-03")[0]).toContain("Fri, Dec 4");
  });
});
