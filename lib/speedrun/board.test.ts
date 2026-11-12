import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import { INBOX_TODAY } from "./inbox";
import type { Action } from "./actions";
import { boardMode, filterRows, introEvents, parsePasted, readPaste, sortRows, TILE_FILTER, tileOfFilter, todayEvents } from "./board";
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
