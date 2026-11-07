import { describe, expect, it } from "vitest";
import { composeBrief, renderBriefEmail } from "./brief";
import { sampleBrief } from "./briefSample";
import { INBOX_TODAY } from "./inbox";

describe("composeBrief", () => {
  it("gives Sam at most three items, led by an intro", () => {
    const brief = sampleBrief("sam");
    expect(brief.items.length).toBeGreaterThan(0);
    expect(brief.items.length).toBeLessThanOrEqual(3);
    expect(brief.items[0].kind).toBe("intro");
  });

  it("gives Maya, on change, nothing when the pipeline has not moved", () => {
    const brief = sampleBrief("maya");
    expect(brief.cadence).toBe("on-change");
    expect(brief.items).toHaveLength(0);
    expect(brief.date).toBe(INBOX_TODAY);
  });

  it("orders intro, reply, due, new role", () => {
    const brief = composeBrief({
      firstName: "Ada",
      cadence: "daily",
      today: INBOX_TODAY,
      intros: ["Cobalt Meadow"],
      pipeline: {
        rows: [
          { company: "Nightfold", role: "Intern", lane: "jobs", furthest: "assessment", exit: "open", lastEventAt: "2026-11-01T12:00:00.000Z", next: null },
          { company: "Halcyon Works", role: "Engineer", lane: "jobs", furthest: "screen", exit: "open", lastEventAt: "2026-11-07T01:00:00.000Z", next: null },
        ],
        stats: { applied: 2, inProcess: 2, intros: 1, offers: 0 },
      },
      result: { matches: [], routes: [], narrowing: { companies: 0, roles: 0, afterFilters: 0, shown: 0 } },
    });
    expect(brief.items.map((item) => item.kind)).toEqual(["intro", "reply", "due"]);
  });
});

describe("renderBriefEmail", () => {
  it("has no script, names the person, and a text part without tags", () => {
    const sam = renderBriefEmail(sampleBrief("sam"), "Sam");
    const maya = renderBriefEmail(sampleBrief("maya"), "Maya");
    for (const out of [sam, maya]) {
      expect(out.html).not.toContain("<script");
      expect(out.text).not.toMatch(/<[^>]+>/);
    }
    expect(sam.html).toContain("Sam");
    expect(sam.subject).toContain("Sam");
    expect(sam.text).toContain("Sam");
    expect(maya.subject).toBe("Maya, nothing moved. that's fine.");
  });

  it("escapes markup in any name or company", () => {
    const out = renderBriefEmail(
      { personKey: "you", date: INBOX_TODAY, cadence: "daily", items: [{ kind: "reply", text: "<b>x</b> replied.", href: null }] },
      "<i>Ada</i>",
    );
    expect(out.html).not.toContain("<b>x");
    expect(out.html).not.toContain("<i>Ada");
  });

  it("only links to https addresses", () => {
    const out = renderBriefEmail(
      { personKey: "you", date: INBOX_TODAY, cadence: "daily", items: [{ kind: "new-role", text: "Role.", href: "javascript:alert(1)" }] },
      "Ada",
    );
    expect(out.html).not.toContain("javascript:");
  });
});
