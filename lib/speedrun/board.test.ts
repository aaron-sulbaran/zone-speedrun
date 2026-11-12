import { describe, expect, it } from "vitest";
import { INBOX_TODAY } from "./inbox";
import type { Action } from "./actions";
import { boardMode, filterRows, introEvents, sortRows, TILE_FILTER, tileOfFilter } from "./board";
import type { AppRow, InboxEvent } from "./types";

function row(company: string, exit: AppRow["exit"], lastEventAt: string, furthest: AppRow["furthest"] = "applied", over: Partial<AppRow> = {}): AppRow {
  return { company, role: null, lane: "jobs", furthest, exit, appliedAt: null, lastEventAt, next: null, ...over };
}

const actionDue = (key: string, due: string | null) => [key, { due } as Action] as const;

describe("filterRows", () => {
  const rows = [
    row("Applied", "open", "2026-11-01"),
    row("Screen", "open", "2026-11-02", "screen"),
    row("Interview", "open", "2026-11-03", "interview"),
    row("Offer", "open", "2026-11-04", "offer"),
    row("Declined", "rejected", "2026-11-05", "offer"),
    row("Rejected", "rejected", "2026-11-06"),
    row("Quiet", "noreply", "2026-10-01"),
  ];
  const names = (filter: Parameters<typeof filterRows>[1]) => filterRows(rows, filter).map((r) => r.company);

  it("keeps every row for Applied (all)", () => {
    expect(names("all")).toHaveLength(7);
  });
  it("keeps open rows past the application and before an offer for In process", () => {
    expect(names("inProcess")).toEqual(["Screen", "Interview"]);
  });
  it("keeps open offers only for Offers", () => {
    expect(names("offers")).toEqual(["Offer"]);
  });
  it("keeps rejected and no-reply rows for Closed", () => {
    expect(names("closed")).toEqual(["Declined", "Rejected", "Quiet"]);
  });
});

describe("sortRows", () => {
  const rows = [
    row("Bravo", "open", "2026-11-01", "applied", { appliedAt: "2026-10-20", role: "Zed" }),
    row("Alpha", "open", "2026-11-05", "offer", { appliedAt: null, role: "Ace" }),
    row("Charlie", "rejected", "2026-11-03", "applied", { appliedAt: "2026-10-25" }),
    row("Delta", "open", "2026-11-04", "screen", { appliedAt: "2026-10-22", role: "Mid" }),
  ];
  const actions = new Map([actionDue("Bravo:Zed", "2026-11-12"), actionDue("Delta:Mid", "2026-11-09"), actionDue("Alpha:Ace", null)]);
  const order = (key: Parameters<typeof sortRows>[1], dir: "asc" | "desc") => sortRows(rows, key, dir, actions).map((r) => r.company);

  it("puts the soonest deadline first by default, then the newest update", () => {
    // Delta due 9th, Bravo due 12th; Alpha and Charlie have none, so the newer update (Alpha) comes first.
    expect(order("next", "asc")).toEqual(["Delta", "Bravo", "Alpha", "Charlie"]);
  });
  it("reverses the deadlines but keeps rows with none last", () => {
    expect(order("next", "desc")).toEqual(["Bravo", "Delta", "Alpha", "Charlie"]);
  });
  it("sorts by company in either direction", () => {
    expect(order("company", "asc")).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    expect(order("company", "desc")).toEqual(["Delta", "Charlie", "Bravo", "Alpha"]);
  });
  it("sorts by role and puts a row with no role last", () => {
    expect(order("role", "asc")).toEqual(["Alpha", "Delta", "Bravo", "Charlie"]);
    expect(order("role", "desc")).toEqual(["Bravo", "Delta", "Alpha", "Charlie"]);
  });
  it("sorts by how far the row got, with closed rows after the open ones", () => {
    expect(order("stage", "asc")).toEqual(["Bravo", "Delta", "Alpha", "Charlie"]);
  });
  it("sorts by applied date and puts a row with no applied event last", () => {
    expect(order("applied", "asc")).toEqual(["Bravo", "Delta", "Charlie", "Alpha"]);
    expect(order("applied", "desc")).toEqual(["Charlie", "Delta", "Bravo", "Alpha"]);
  });
  it("sorts by the last update", () => {
    expect(order("lastUpdate", "desc")).toEqual(["Alpha", "Delta", "Charlie", "Bravo"]);
    expect(order("lastUpdate", "asc")).toEqual(["Bravo", "Charlie", "Delta", "Alpha"]);
  });
  it("does not change the rows it was given", () => {
    const before = rows.map((r) => r.company);
    sortRows(rows, "company", "desc", actions);
    expect(rows.map((r) => r.company)).toEqual(before);
  });
});

describe("boardMode", () => {
  it("shows the whole board once the inbox is connected and has rows", () => {
    expect(boardMode("sam", true, 4)).toBe("full");
  });
  it("asks a sample person to connect before showing anything", () => {
    expect(boardMode("sam", false, 0)).toBe("connect");
  });
  it("points a visitor with no person and no inbox to Connect and Matches", () => {
    expect(boardMode(null, false, 0)).toBe("empty");
  });
  it("points a connected board with no rows to the same line instead of empty tiles", () => {
    expect(boardMode(null, true, 0)).toBe("empty");
  });
});

function event(kind: InboxEvent["kind"], date: string, company = "Halcyon Works"): InboxEvent {
  return { emailId: `${kind}-${date}`, company, role: null, kind, date, lane: "jobs" };
}

describe("introEvents", () => {
  const events = [event("interview", `${INBOX_TODAY}T09:00:00.000Z`), event("applied", "2026-11-01T09:00:00.000Z"), event("other", `${INBOX_TODAY}T10:00:00.000Z`), event("intro", `${INBOX_TODAY}T11:00:00.000Z`, "Pinewick")];

  it("lists the intro events", () => {
    expect(introEvents(events).map((e) => e.company)).toEqual(["Pinewick"]);
  });
});

describe("tiles and chips", () => {
  it("maps each filtering tile to the chip it sets, and back; Intros sets none", () => {
    expect(TILE_FILTER).toEqual({ applied: "all", inProcess: "inProcess", offers: "offers" });
    expect(TILE_FILTER.intros).toBeUndefined();
    expect(tileOfFilter("offers")).toBe("offers");
    expect(tileOfFilter("inProcess")).toBe("inProcess");
    expect(tileOfFilter("all")).toBeNull();
    expect(tileOfFilter("closed")).toBeNull();
  });
});
