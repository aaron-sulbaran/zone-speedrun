import { describe, expect, it } from "vitest";
import { readPaste } from "./board";
import { classifyEmail } from "./classify";
import { buildPipeline } from "./pipeline";
import type { InboxEmail, InboxEvent } from "./types";

function event(kind: InboxEvent["kind"], date: string, company = "Halcyon Works", role: string | null = "Engineer"): InboxEvent {
  return { emailId: `${kind}-${date}`, company, role, kind, date, lane: "jobs" };
}

describe("buildPipeline", () => {
  it("walks applied, interview and rejection into one rejected row", () => {
    const pipeline = buildPipeline(
      [event("applied", "2026-10-01"), event("interview", "2026-10-10"), event("rejection", "2026-10-15")],
      "2026-11-01",
    );
    expect(pipeline.rows).toHaveLength(1);
    expect(pipeline.rows[0].furthest).toBe("interview");
    expect(pipeline.rows[0].exit).toBe("rejected");
    expect(pipeline.rows[0].lastEventAt).toBe("2026-10-15");
  });

  it("marks an applied event older than 21 days as no reply", () => {
    const pipeline = buildPipeline([event("applied", "2026-10-02")], "2026-11-01");
    expect(pipeline.rows[0].exit).toBe("noreply");
  });

  it("keeps a recent applied event open", () => {
    const pipeline = buildPipeline([event("applied", "2026-10-25")], "2026-11-01");
    expect(pipeline.rows[0].exit).toBe("open");
    expect(pipeline.rows[0].next).not.toBeNull();
  });

  it("groups by company and role and counts the stats", () => {
    const pipeline = buildPipeline(
      [
        event("applied", "2026-10-01", "A"),
        event("assessment", "2026-10-05", "A"),
        event("applied", "2026-10-28", "B"),
        event("applied", "2026-10-01", "C", "Designer"),
        event("applied", "2026-10-01", "C", "Engineer"),
        event("offer", "2026-10-20", "C", "Engineer"),
        event("intro", "2026-10-22", "D", null),
      ],
      "2026-11-01",
    );
    expect(pipeline.rows).toHaveLength(4);
    expect(pipeline.stats).toEqual({ applied: 4, inProcess: 1, intros: 1, offers: 1 });
  });

  it("folds a three email Acme sequence into one row that reached interview", () => {
    const mail = (id: string, from: string, subject: string, body: string, date: string): InboxEmail => ({ id, from, subject, body, date });
    const events = [
      mail("1", "Acme Careers <jobs@acme.example>", "Thanks for applying for the Product Engineer role at Acme", "We received it.", "2026-10-01T10:00:00.000Z"),
      mail("2", "Acme Hiring <hiring@acme.example>", "Interview invitation", "We would like to invite you to an interview with our co-founder.", "2026-10-08T10:00:00.000Z"),
      mail("3", "Priya Shah <priya@acme.example>", "Final round", "Final round scheduling for the Product Engineer role.", "2026-10-15T10:00:00.000Z"),
    ].map(classifyEmail);
    const pipeline = buildPipeline(events, "2026-11-01");
    expect(pipeline.rows).toHaveLength(1);
    expect(pipeline.rows[0].furthest).toBe("interview");
    expect(pipeline.rows[0].role).toBe("Product Engineer");
    expect(pipeline.rows[0].lane).toBe("jobs");
  });

  it("keeps a platform confirmation, a platform assessment and a person's screen on one Acme row", () => {
    const mail = (id: string, from: string, subject: string, body: string, date: string): InboxEmail => ({ id, from, subject, body, date });
    const events = [
      mail("1", "Greenhouse <no-reply@greenhouse.io>", "Thanks for applying to Acme", "We received your application.", "2026-10-20T10:00:00.000Z"),
      mail("2", "CodeSignal <no-reply@codesignal.com>", "Your CodeSignal assessment", "Acme invited you to take a CodeSignal assessment.", "2026-10-22T10:00:00.000Z"),
      mail("3", "Priya <priya@acme.example>", "Phone screen", "Can we set up a phone screen?", "2026-10-25T10:00:00.000Z"),
    ].map(classifyEmail);
    const pipeline = buildPipeline(events, "2026-11-01");
    expect(pipeline.rows).toHaveLength(1);
    expect(pipeline.rows[0].furthest).toBe("screen");
    expect(pipeline.rows[0].company).toBe("Acme");
  });

  it("keeps a mailbox named after the company on that company's one row", () => {
    const mail = (id: string, from: string, subject: string, body: string, date: string): InboxEmail => ({ id, from, subject, body, date });
    const events = [
      mail("1", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We received your application.", "2026-10-01T10:00:00.000Z"),
      mail("2", "Tidewell Talent Acquisition <ta@tidewell.example>", "Your onsite", "We'd like to invite you to an onsite interview. Please share your availability.", "2026-10-12T10:00:00.000Z"),
      mail("3", "Nadia Okafor <nadia@tidewell.example>", "Following up", "Thank you for interviewing with us. We have chosen another candidate for the role.", "2026-10-20T10:00:00.000Z"),
    ].map(classifyEmail);
    const pipeline = buildPipeline(events, "2026-11-01");
    expect(pipeline.rows).toHaveLength(1);
    expect(pipeline.rows[0].company).toBe("Tidewell");
    expect(pipeline.rows[0].furthest).toBe("interview");
    expect(pipeline.rows[0].exit).toBe("rejected");
  });

  it("folds a short company name into the longer name it starts", () => {
    const pipeline = buildPipeline(
      [event("applied", "2026-10-01", "Halden Robotics", null), event("interview", "2026-10-08", "Halden", null), event("rejection", "2026-10-12", "Haldenrobotics", null)],
      "2026-11-01",
    );
    expect(pipeline.rows).toHaveLength(1);
    expect(pipeline.rows[0].company).toBe("Halden Robotics");
    expect(pipeline.rows[0].furthest).toBe("interview");
    expect(pipeline.rows[0].exit).toBe("rejected");
  });

  it("keeps a short name apart when two longer names start with it", () => {
    const pipeline = buildPipeline(
      [event("applied", "2026-10-01", "Acme Bank", null), event("applied", "2026-10-02", "Acme Robotics", null), event("screen", "2026-10-05", "Acme", null)],
      "2026-11-01",
    );
    expect(pipeline.rows.map((row) => row.company).sort()).toEqual(["Acme", "Acme Bank", "Acme Robotics"]);
  });

  it("does not fold names that share letters but not a word", () => {
    const pipeline = buildPipeline([event("applied", "2026-10-01", "Nova", null), event("applied", "2026-10-02", "Novarise", null)], "2026-11-01");
    expect(pipeline.rows).toHaveLength(2);
  });

  describe("folding stays within one source", () => {
    const sample = [
      { ...event("applied", "2026-10-01", "Cobalt Meadow", null), emailId: "sam-0001" },
      { ...event("rejection", "2026-10-20", "Cobalt Meadow", null), emailId: "sam-0002" },
    ];
    const paste = (from: string, subject: string): InboxEvent => {
      const outcome = readPaste(`From: ${from}\nSubject: ${subject}\n\nWe received your application.`, []);
      if (outcome.kind !== "added") throw new Error(`paste was ${outcome.kind}`);
      return outcome.event;
    };

    it("keeps a pasted short name off the sample row it starts", () => {
      const pasted = paste("Cobalt <no-reply@hire.lever.co>", "Thank you for applying to Cobalt");
      expect(pasted.company).toBe("Cobalt");
      const rows = buildPipeline([...sample, pasted], "2026-11-07").rows;
      expect(rows.map((row) => row.company).sort()).toEqual(["Cobalt", "Cobalt Meadow"]);
      expect(rows.find((row) => row.company === "Cobalt Meadow")?.exit).toBe("rejected");
    });

    it("still folds two pasted names into one row", () => {
      const short = paste("Halden <no-reply@hire.lever.co>", "Thank you for applying to Halden");
      const long = { ...paste("Halden Robotics <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Halden Robotics"), kind: "interview" as const };
      const rows = buildPipeline([...sample, short, long], "2026-11-07").rows;
      expect(rows.map((row) => row.company).sort()).toEqual(["Cobalt Meadow", "Halden"]);
      expect(rows.find((row) => row.company === "Halden")?.furthest).toBe("interview");
    });

    it("still joins a pasted email to a sample row with the same name", () => {
      const pasted = { ...paste("Cobalt Meadow <no-reply@hire.lever.co>", "Thank you for applying to Cobalt Meadow"), kind: "screen" as const };
      const rows = buildPipeline([...sample, pasted], "2026-11-07").rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].furthest).toBe("screen");
    });
  });
});
