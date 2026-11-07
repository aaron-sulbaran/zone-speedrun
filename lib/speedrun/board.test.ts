import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import { INBOX_TODAY } from "./inbox";
import { introEvents, moveTarget, parsePasted, tableRows, todayEvents } from "./board";
import type { AppRow, BoardCard, InboxEvent } from "./types";

const ORDER: BoardCard[] = ["today", "matches", "pipeline", "flow", "intros", "tools"];

describe("moveTarget", () => {
  it("steps past the matches card, which the board does not own", () => {
    expect(moveTarget(ORDER, "pipeline", -1)).toBe(0);
    expect(moveTarget(ORDER, "today", 1)).toBe(2);
  });

  it("returns null at the ends", () => {
    expect(moveTarget(ORDER, "today", -1)).toBeNull();
    expect(moveTarget(ORDER, "tools", 1)).toBeNull();
  });

  it("produces an index the reducer accepts", () => {
    const to = moveTarget(ORDER, "flow", 1) as number;
    const rest = ORDER.filter((card) => card !== "flow");
    expect([...rest.slice(0, to), "flow", ...rest.slice(to)]).toEqual(["today", "matches", "pipeline", "intros", "flow", "tools"]);
  });
});

function row(company: string, exit: AppRow["exit"], lastEventAt: string): AppRow {
  return { company, role: null, lane: "jobs", furthest: "applied", exit, lastEventAt, next: null };
}

describe("tableRows", () => {
  const rows = [row("A", "rejected", "2026-11-06"), row("B", "open", "2026-10-01"), row("C", "open", "2026-11-01"), row("D", "noreply", "2026-11-05")];

  it("puts live rows first, then the most recent", () => {
    expect(tableRows(rows, false, 8).shown.map((r) => r.company)).toEqual(["C", "B", "A", "D"]);
  });

  it("caps the list and reports the total", () => {
    const result = tableRows(rows, false, 2);
    expect(result.shown).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(tableRows(rows, true, 2).shown).toHaveLength(4);
  });
});

function event(kind: InboxEvent["kind"], date: string, company = "Halcyon Works"): InboxEvent {
  return { emailId: `${kind}-${date}`, company, role: null, kind, date, lane: "jobs" };
}

describe("todayEvents and introEvents", () => {
  const events = [event("interview", `${INBOX_TODAY}T09:00:00.000Z`), event("applied", "2026-11-01T09:00:00.000Z"), event("other", `${INBOX_TODAY}T10:00:00.000Z`), event("intro", `${INBOX_TODAY}T11:00:00.000Z`, "Pinewick")];

  it("keeps only real events dated today, newest first", () => {
    expect(todayEvents(events, INBOX_TODAY).map((e) => e.kind)).toEqual(["intro", "interview"]);
  });

  it("lists the intro events", () => {
    expect(introEvents(events).map((e) => e.company)).toEqual(["Pinewick"]);
  });
});

describe("parsePasted", () => {
  const BODY = "We would like to invite you to a final round interview.\nRole: Software Engineer";

  it("reads From and Subject headers", () => {
    const email = parsePasted(`From: Halcyon Works Hiring <hiring@halcyonworks.com>\nSubject: Interview invitation: Software Engineer\n\n${BODY}`, 1);
    expect(email?.from).toBe("Halcyon Works Hiring <hiring@halcyonworks.com>");
    expect(email?.subject).toBe("Interview invitation: Software Engineer");
    expect(email?.body).toContain("final round");
    expect(email?.date.startsWith(INBOX_TODAY)).toBe(true);
    expect(classifyEmail(email!).kind).toBe("interview");
  });

  it("treats the first line as the subject when there are no headers", () => {
    const email = parsePasted(`Interview invitation: Software Engineer at Halcyon Works\n${BODY}`, 2);
    expect(email?.subject).toBe("Interview invitation: Software Engineer at Halcyon Works");
    expect(email?.from).toBe("");
  });

  it("returns null for empty text and clips long text", () => {
    expect(parsePasted("   \n  ", 3)).toBeNull();
    expect(parsePasted("x".repeat(50_000), 4)?.body.length).toBeLessThanOrEqual(20_000);
  });
});
