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

  describe("real world emails", () => {
    const hr = "Acme Careers <jobs@acme.com>";
    const cases: Array<[string, EventKind, InboxEmail]> = [
      ["negated offer", "rejection", email(hr, "Your application", "After careful thought, we are not able to extend an offer at this time.")],
      ["bare unfortunately with an interview", "interview", email("Priya Shah <priya@acme.com>", "Interview time", "Unfortunately our interviewer is out sick, could we move your interview to Friday?")],
      ["bare unfortunately in a shop", "other", email("Frost Boxes <hi@frostboxes.com>", "Sold out", "Unfortunately our holiday box sold out. Join the waitlist.")],
      ["regret to inform", "rejection", email(hr, "Your application to Acme", "We regret to inform you that the position has been filled.")],
      ["pursue other candidates", "rejection", email(hr, "Update", "We have decided to pursue other candidates for the role.")],
      ["move forward with other candidates", "rejection", email(hr, "Update", "We will move forward with other candidates.")],
      ["thank you for applying", "applied", email(hr, "Thank you for applying to Acme", "Our team will review your materials.")],
      ["application has been received", "applied", email(hr, "Acme application", "Your application has been received.")],
      ["would like to offer", "offer", email(hr, "Good news", "We would like to offer you the Software Engineer position.")],
      ["introduce you", "intro", email("Jo Lin <jo@friend.org>", "Meet Sam", "I would like to introduce you to Sam, a founder in your area.")],
      ["introduce you two", "intro", email("Jo Lin <jo@friend.org>", "Hello both", "I wanted to introduce you two, you should talk.")],
      ["online coding test", "assessment", email(hr, "Next steps", "Please complete the online coding test for your application.")],
      ["online assessment", "assessment", email(hr, "Next steps", "Please finish the online assessment for the role you applied for.")],
      ["hackerrank", "assessment", email("HackerRank Tests <no-reply@hackerrank.com>", "Test invitation from Acme", "You have been invited to a HackerRank test.")],
      ["codesignal", "assessment", email("CodeSignal <no-reply@codesignal.com>", "Your CodeSignal assessment", "Acme invited you to take a CodeSignal assessment.")],
      ["calendar notification", "other", email("Google Calendar <calendar-notification@google.com>", "Invitation: Interview with Acme", "You have been invited to an interview with Acme.")],
      ["greenhouse confirmation", "applied", email("Acme <no-reply@greenhouse.io>", "Thanks for applying to Acme", "We received your application. We may schedule an interview if it is a fit.")],
      ["job digest", "other", email("LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>", "12 new jobs for software engineer", "Apply now. Tips for your interview and assessment prep.")],
      ["interview tips newsletter", "other", email("Career Weekly <news@careerweekly.com>", "Ace your next interview", "Practice an assessment and a mock interview this week.")],
    ];
    for (const [name, kind, fixture] of cases) {
      it(`${name} is ${kind}`, () => {
        expect(classifyEmail(fixture).kind).toBe(kind);
      });
    }

    it("takes the company from the domain for a person or a platform sender", () => {
      expect(classifyEmail(email("Priya Shah <priya@acme.com>", "Final round", "Final round details attached.")).company).toBe("Acme");
      expect(classifyEmail(email("Greenhouse <no-reply@greenhouse.io>", "Thanks for applying to Acme", "We received your application.")).company).toBe("Acme");
    });

    it("reads a role from the applying-for subject", () => {
      const event = classifyEmail(email(hr, "Thanks for applying for the Product Engineer role at Acme", "Hello."));
      expect(event.role).toBe("Product Engineer");
    });
  });
});
