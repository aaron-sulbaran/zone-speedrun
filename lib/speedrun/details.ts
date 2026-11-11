import type { PersonKey } from "./types";

/** Every contact is Aaron under a different title, so no real person's name appears in the demo. */
export type Contact = { name: "Aaron Sulbaran"; title: string };

export type CompanyDetail = {
  contact: Contact;
  /** ISO date the next step is due. */
  due?: string;
  /** A made-up call. The link is text for the sheet, never an href. */
  meeting?: { at: string; link: string };
  prep?: string[];
  /** A real address only; the demo's companies are made up, so none has one. */
  site?: string;
  introStatus?: "requested" | "replied" | "scheduled" | "waiting";
};

const aaron = (title: string): Contact => ({ name: "Aaron Sulbaran", title });

/**
 * Sam's pinned set, keyed by company. Dates are made up and anchored to INBOX_TODAY (a Saturday): the two open offers
 * come from his seeded inbox, the Vantablue screen and the min/Max intro from PINNED, the rest from OVERNIGHT.
 */
export const DETAILS: Partial<Record<PersonKey, Record<string, CompanyDetail>>> = {
  sam: {
    Wrenfield: { contact: aaron("Head of Engineering, Wrenfield"), due: "2026-11-09" },
    // The founders said "this week"; the id of this action is the brief's "a founder replied" line, so both agree.
    "Lumora Health": { contact: aaron("Co-founder, Lumora Health"), due: "2026-11-10", introStatus: "replied" },
    "Cindermoor Cloud": { contact: aaron("Recruiting Lead, Cindermoor Cloud"), due: "2026-11-11" },
    Quillbright: { contact: aaron("Engineering Manager, Quillbright"), due: "2026-11-12" },
    "Tarnmoor Robotics": { contact: aaron("Founder, Tarnmoor Robotics") },
    Vantablue: { contact: aaron("Technical Recruiter, Vantablue") },
    "min/Max": {
      contact: aaron("Founder, min/Max"),
      introStatus: "scheduled",
      meeting: { at: "2026-11-10T15:00:00.000Z", link: "https://meet.example/minmax-intro" },
      prep: [
        "Say what min/Max does in one sentence",
        "Bring one thing I've shipped to show them",
        "Ask what they would build next with another engineer",
      ],
    },
  },
};
