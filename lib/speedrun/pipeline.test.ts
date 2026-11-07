import { describe, expect, it } from "vitest";
import { buildPipeline } from "./pipeline";
import type { InboxEvent } from "./types";

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
});
