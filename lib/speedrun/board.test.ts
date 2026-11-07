import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import { INBOX_TODAY } from "./inbox";
import { introEvents, moveTarget, parsePasted, readPaste, tableRows, todayEvents } from "./board";
import type { AppRow, BoardCard, InboxEvent } from "./types";

const ORDER: BoardCard[] = ["today", "pipeline", "flow", "intros", "tools"];

describe("moveTarget", () => {
  it("steps one card at a time", () => {
    expect(moveTarget(ORDER, "pipeline", -1)).toBe(0);
    expect(moveTarget(ORDER, "today", 1)).toBe(1);
  });

  it("returns null at the ends", () => {
    expect(moveTarget(ORDER, "today", -1)).toBeNull();
    expect(moveTarget(ORDER, "tools", 1)).toBeNull();
  });

  it("produces an index the reducer accepts", () => {
    const to = moveTarget(ORDER, "flow", 1) as number;
    const rest = ORDER.filter((card) => card !== "flow");
    expect([...rest.slice(0, to), "flow", ...rest.slice(to)]).toEqual(["today", "pipeline", "intros", "flow", "tools"]);
  });
});

function row(company: string, exit: AppRow["exit"], lastEventAt: string, furthest: AppRow["furthest"] = "applied"): AppRow {
  return { company, role: null, lane: "jobs", furthest, exit, lastEventAt, next: null };
}

describe("tableRows", () => {
  const rows = [row("A", "rejected", "2026-11-06"), row("B", "open", "2026-10-01"), row("C", "open", "2026-11-01"), row("D", "noreply", "2026-11-05")];

  it("puts live rows first, then the most recent", () => {
    expect(tableRows(rows, false, 8).shown.map((r) => r.company)).toEqual(["C", "B", "A", "D"]);
  });

  it("puts the furthest stage first among live rows, then the most recent", () => {
    const mixed = [row("New", "open", "2026-11-06"), row("Deep", "open", "2026-09-01", "interview"), row("Mid", "open", "2026-10-01", "screen"), row("Late", "open", "2026-10-20", "screen")];
    expect(tableRows(mixed, false, 8).shown.map((r) => r.company)).toEqual(["Deep", "Late", "Mid", "New"]);
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
  const FROM = "Halcyon Works Hiring <hiring@halcyonworks.example>";

  it("reads From and Subject headers", () => {
    const email = parsePasted(`From: ${FROM}\nSubject: Interview invitation: Software Engineer\n\n${BODY}`);
    expect(email?.from).toBe(FROM);
    expect(email?.subject).toBe("Interview invitation: Software Engineer");
    expect(email?.body).toContain("final round");
    expect(email?.date.startsWith(INBOX_TODAY)).toBe(true);
    expect(classifyEmail(email!).kind).toBe("interview");
  });

  it("treats the first line as the subject when there are no headers", () => {
    const email = parsePasted(`Interview invitation: Software Engineer at Halcyon Works\n${BODY}`);
    expect(email?.subject).toBe("Interview invitation: Software Engineer at Halcyon Works");
    expect(email?.from).toBe("");
  });

  it("skips every leading blank line before the headers", () => {
    const email = parsePasted(`\n\n  \n\nFrom: ${FROM}\nSubject: Interview invitation\n\n${BODY}`);
    expect(email?.from).toBe(FROM);
    expect(email?.subject).toBe("Interview invitation");
  });

  it("reads a bare sender line from a copied mail client", () => {
    const email = parsePasted(`Interview invitation: Software Engineer\n${FROM}\nto me\n\n${BODY}`);
    expect(email?.from).toBe(FROM);
    expect(email?.subject).toBe("Interview invitation: Software Engineer");
    expect(email?.body).not.toContain("<hiring@");
    expect(classifyEmail(email!).company).toBe("Halcyon Works");
  });

  it("reads a Gmail forward block, without the From label in the company", () => {
    const email = parsePasted(`---------- Forwarded message ---------\nFrom: ${FROM}\nDate: Thu, Nov 5, 2026 at 9:00 AM\nSubject: Interview invitation: Software Engineer\nTo: me@example.com\n\n${BODY}`);
    expect(email?.from).toBe(FROM);
    expect(email?.subject).toBe("Interview invitation: Software Engineer");
    expect(classifyEmail(email!).company).toBe("Halcyon Works");
  });

  it("strips a From label from a bare sender line", () => {
    const email = parsePasted(`Interview invitation: Software Engineer\nFrom: ${FROM}\n\n${BODY}`);
    expect(email?.from).toBe(FROM);
  });

  it("does not take a sentence with an address in it for the sender", () => {
    const email = parsePasted(`Interview invitation: Software Engineer\nSam, meet Jane Doe <jane@pinewick.example>\n\n${BODY}`);
    expect(email?.from).toBe("");
    expect(email?.body).toContain("meet Jane Doe");
  });

  it("reads an Outlook block with a Sent line", () => {
    const email = parsePasted(`From: ${FROM}\nSent: Thursday, November 5, 2026 9:00 AM\nTo: Sam\nCc: Pat\nSubject: Interview invitation: Software Engineer\n\n${BODY}`);
    expect(email?.subject).toBe("Interview invitation: Software Engineer");
    expect(email?.from).toBe(FROM);
  });

  it("clamps long headers", () => {
    const email = parsePasted(`From: ${"a".repeat(5000)}\nSubject: ${"b".repeat(5000)}\n\n${BODY}`);
    expect(email?.from.length).toBe(200);
    expect(email?.subject.length).toBe(200);
  });

  it("returns null for empty text and clips long text", () => {
    expect(parsePasted("   \n  ")).toBeNull();
    expect(parsePasted("x".repeat(50_000))?.body.length).toBeLessThanOrEqual(20_000);
  });

  it("gives the same id to the same sender and subject, and another id to another subject", () => {
    expect(parsePasted(`From: ${FROM}\nSubject: Hi\n\none`)?.id).toBe(parsePasted(`From: ${FROM}\nSubject: Hi\n\none`)?.id);
    expect(parsePasted(`From: ${FROM}\nSubject: Hi\n\n`)?.id).not.toBe(parsePasted(`From: ${FROM}\nSubject: Other\n\n`)?.id);
  });
});

describe("readPaste", () => {
  const INVITE = "From: Halcyon Works Hiring <hiring@halcyonworks.example>\nSubject: Interview invitation\n\nWe would like to invite you to a final round interview.\nRole: Software Engineer";

  it("adds a classified email once, and calls the second the same email", () => {
    const first = readPaste(INVITE, []);
    expect(first.kind).toBe("added");
    if (first.kind !== "added") return;
    expect(first.event.company).toBe("Halcyon Works");
    expect(readPaste(INVITE, [first.event]).kind).toBe("duplicate");
  });

  it("keeps a later email with the same subject, such as a rejection after a confirmation", () => {
    const subject = "Your application";
    const confirm = readPaste(`From: Halcyon Works Careers <noreply@halcyonworks.example>\nSubject: ${subject}\n\nThanks for applying. We received your application for the Software Engineer role.\nRole: Software Engineer`, []);
    expect(confirm.kind).toBe("added");
    if (confirm.kind !== "added") return;
    const reject = readPaste(`From: Halcyon Works Careers <noreply@halcyonworks.example>\nSubject: ${subject}\n\nUnfortunately we will not be moving forward with your application.\nRole: Software Engineer`, [confirm.event]);
    expect(reject.kind).toBe("added");
  });

  it("does not add what it cannot classify", () => {
    expect(readPaste("Weekly newsletter\nTen recipes you will love.", []).kind).toBe("unknown");
    expect(readPaste("", []).kind).toBe("unknown");
  });

  it("does not add an email whose sender it cannot name", () => {
    expect(readPaste("Interview invitation\nWe would like to invite you to a final round interview.", []).kind).toBe("unknownSender");
  });
});
