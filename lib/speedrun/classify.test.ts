import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import type { EventKind, InboxEmail } from "./types";

function email(from: string, subject: string, body: string): InboxEmail {
  return { id: "t-1", from, subject, body, date: "2026-10-01T15:00:00.000Z" };
}

const FIXTURES: Array<[EventKind, InboxEmail]> = [
  [
    "applied",
    email(
      "Halcyon Works Careers <noreply@halcyonworks.com>",
      "Thanks for applying to Halcyon Works",
      "We received your application for the Software Engineer role at Halcyon Works.\nRole: Software Engineer",
    ),
  ],
  [
    "assessment",
    email(
      "Halcyon Works Careers <noreply@halcyonworks.com>",
      "Next step: take-home assessment",
      "Please complete the coding challenge within five days.\nRole: Software Engineer",
    ),
  ],
  [
    "screen",
    email(
      "Halcyon Works Talent Team <talent@halcyonworks.com>",
      "Can we set up a phone screen?",
      "A quick intro call with our talent team, about 20 minutes.\nRole: Software Engineer",
    ),
  ],
  [
    "interview",
    email(
      "Halcyon Works Hiring <hiring@halcyonworks.com>",
      "Interview invitation: Software Engineer",
      "We would like to invite you to a final round interview.\nRole: Software Engineer",
    ),
  ],
  [
    "offer",
    email(
      "Halcyon Works Hiring <hiring@halcyonworks.com>",
      "Your offer letter",
      "We are pleased to offer you the Software Engineer position.\nRole: Software Engineer",
    ),
  ],
  [
    "rejection",
    email(
      "Halcyon Works Careers <noreply@halcyonworks.com>",
      "Update on your application",
      "Unfortunately we will not be moving forward with your application.\nRole: Software Engineer",
    ),
  ],
  [
    "intro",
    email(
      "Founders at Halcyon Works <hello@halcyonworks.com>",
      "Introduction: you and a founder",
      "I am introducing you to a founder who is building in your space.",
    ),
  ],
];

describe("classifyEmail", () => {
  for (const [kind, fixture] of FIXTURES) {
    it(`classifies a ${kind} email`, () => {
      const event = classifyEmail(fixture);
      expect(event.kind).toBe(kind);
      expect(event.company).toBe("Halcyon Works");
      expect(event.emailId).toBe("t-1");
    });
  }

  it("reads the role line when present", () => {
    expect(classifyEmail(FIXTURES[0][1]).role).toBe("Software Engineer");
  });

  it("marks a recipe newsletter as other", () => {
    const event = classifyEmail(
      email("Weeknight Table <news@weeknighttable.com>", "Five dinners under 30 minutes", "This week: lemon pasta, sheet-pan chicken and a crisp slaw."),
    );
    expect(event.kind).toBe("other");
  });

  it("puts accelerator and fund threads in the founder lane", () => {
    const event = classifyEmail(
      email("Larkspur Accelerator <apply@larkspur.vc>", "Thanks for applying to the Spring batch", "Your accelerator application was received. Role: Spring batch"),
    );
    expect(event.lane).toBe("founder");
    expect(event.kind).toBe("applied");
  });

  it("falls back to the sender domain when the display name is missing", () => {
    const event = classifyEmail(email("jobs@brightpath.io", "Thanks for applying", "We received your application."));
    expect(event.company).toBe("Brightpath");
  });
});
