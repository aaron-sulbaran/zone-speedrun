import type { Match } from "./match";
import { matchKey } from "./matchList";

// Every name, company and line here is invented. Companies come only from
// FICTIONAL_COMPANIES; the sample test checks that none is a real speedrun company.

export type DeskStage = "requested" | "withFounder" | "connected" | "tracking" | "outcome";

export type SampleCard = { id: string; firstName: string; company: string; role: string; stage: DeskStage; pill: string };

export const DESK_SAMPLES: SampleCard[] = [
  { id: "s-requested-1", firstName: "Priya", company: "Quillbright", role: "Product Engineer", stage: "requested", pill: "" },
  { id: "s-requested-2", firstName: "Tomas", company: "Marrow Analytics", role: "Data Engineer", stage: "requested", pill: "" },
  { id: "s-founder-1", firstName: "Imani", company: "Tessel Harbor", role: "Designer", stage: "withFounder", pill: "" },
  { id: "s-founder-2", firstName: "Leif", company: "Copperfield Systems", role: "Founding Engineer", stage: "withFounder", pill: "" },
  { id: "s-connected-1", firstName: "Noor", company: "Halcyon Works", role: "Operations Lead", stage: "connected", pill: "" },
  { id: "s-tracking-1", firstName: "Wen", company: "Fernwick", role: "ML Engineer", stage: "tracking", pill: "intro sent" },
  { id: "s-tracking-2", firstName: "Sasha", company: "Lumora Health", role: "Product Manager", stage: "tracking", pill: "first chat" },
  { id: "s-outcome-1", firstName: "Dario", company: "Ostrava Labs", role: "Full-Stack Engineer", stage: "outcome", pill: "hired" },
  { id: "s-outcome-2", firstName: "Maren", company: "Pinewick", role: "Product Designer", stage: "outcome", pill: "no offer" },
];

export type FinishedSample = {
  card: SampleCard;
  timeline: { label: string; when: string }[];
  survey: { candidate: string; founder: string };
  tag: "fitHit";
};

export const FINISHED_SAMPLE: FinishedSample = {
  card: DESK_SAMPLES[7],
  timeline: [
    { label: "Intro sent", when: "week 1" },
    { label: "First chat", when: "week 1" },
    { label: "Interviews", when: "week 2 to 3" },
    { label: "Offer", when: "week 4" },
    { label: "Hired", when: "week 5" },
  ],
  survey: {
    candidate: "The team wanted exactly what I had shipped, and the first chat felt like a working session.",
    founder: "Dario came with a real opinion on our onboarding and had already shipped something close to it.",
  },
  tag: "fitHit",
};

export type Rival = { id: string; firstName: string; headline: string; whyThem: string; whyRole: string; project: string };

export type RivalPool = "engineering" | "ai" | "product" | "design" | "operations" | "default";

export const RIVALS: Record<RivalPool, Rival[]> = {
  engineering: [
    { id: "r-eng-1", firstName: "Jonah", headline: "Backend engineer, two seed-stage launches", whyThem: "Shipped a billing service that handled a launch-day spike without a page.", whyRole: "Wants a small team where one person owns a system end to end.", project: "A queue-backed billing service" },
    { id: "r-eng-2", firstName: "Anika", headline: "Full-stack engineer, strong on product sense", whyThem: "Rebuilt a checkout flow and cut abandoned carts by a third.", whyRole: "Wants to work next to the founders on what to build next.", project: "A rebuilt checkout flow" },
  ],
  ai: [
    { id: "r-ai-1", firstName: "Kofi", headline: "ML engineer, evals and retrieval", whyThem: "Built an eval harness that caught regressions before every release.", whyRole: "Wants to turn a promising model into something customers rely on.", project: "A retrieval eval harness" },
    { id: "r-ai-2", firstName: "Ingrid", headline: "Applied AI engineer, agents in production", whyThem: "Put a support agent in front of real tickets and measured it against humans.", whyRole: "Wants an early team shipping AI features weekly.", project: "A support triage agent" },
  ],
  product: [
    { id: "r-prod-1", firstName: "Rafael", headline: "Product manager who still writes code", whyThem: "Ran a pricing test that doubled activation for a self-serve tier.", whyRole: "Wants the product job to include building the first version himself.", project: "A self-serve pricing test" },
    { id: "r-prod-2", firstName: "Hana", headline: "Product lead, zero-to-one launches", whyThem: "Took an internal tool to a paid product with the first ten customers.", whyRole: "Wants to own a product surface, not a roadmap slide.", project: "An internal tool turned product" },
  ],
  design: [
    { id: "r-des-1", firstName: "Elio", headline: "Product designer, systems and motion", whyThem: "Shipped a design system that three engineers adopted in a week.", whyRole: "Wants to design in code with a team that ships daily.", project: "A small design system" },
    { id: "r-des-2", firstName: "Sunita", headline: "Brand and product designer", whyThem: "Redesigned an onboarding that lifted week-one retention.", whyRole: "Wants one person to carry both brand and product.", project: "A redesigned onboarding" },
  ],
  operations: [
    { id: "r-ops-1", firstName: "Callum", headline: "Operations lead, first hire energy", whyThem: "Stood up hiring, payroll and vendor basics for a ten-person team.", whyRole: "Wants to be the person who makes the company run.", project: "A first-year ops playbook" },
    { id: "r-ops-2", firstName: "Mei", headline: "Chief of staff, early stage", whyThem: "Ran the founder's weekly rhythm and closed two enterprise pilots.", whyRole: "Wants to multiply a founder's time.", project: "A pilot-to-contract program" },
  ],
  default: [
    { id: "r-def-1", firstName: "Gabe", headline: "Generalist who ships", whyThem: "Picked up three different roles in a year and shipped in each.", whyRole: "Wants a small team where the job is whatever matters next.", project: "A cross-functional launch" },
    { id: "r-def-2", firstName: "Odette", headline: "Builder with a fast learning curve", whyThem: "Went from first commit to a live feature in the first two weeks.", whyRole: "Wants to learn the business by working inside it.", project: "A first-month feature" },
  ],
};

/** A small, stable string hash: the same key always lands on the same rivals. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** The snapshot's role functions are not the Fn list; research reads as ai, the rest without a pool as default. */
export function rivalPool(fn: string | null): RivalPool {
  switch (fn) {
    case "engineering":
    case "product":
    case "design":
    case "operations":
      return fn;
    case "research":
      return "ai";
    default:
      return "default";
  }
}

export function rivalsFor(match: Match): Rival[] {
  const pool = RIVALS[rivalPool(match.role?.fn ?? null)];
  const start = hash(matchKey(match)) % pool.length;
  return [pool[start], pool[(start + 1) % pool.length]];
}

export const LEARNED: string[] = [
  "Intros that cite the candidate's own shipped work got a founder reply faster than ones that cite a title.",
  "One intro missed on people: the skills fit but the founder wanted someone who had managed a team, matching unchanged.",
  "Candidates who gave a one-line reason for the role were asked to a first chat more often.",
];

export const LEARNED_FROM_SAMPLE = "A hired sample shows the survey answers lining up: both sides called the match a fit, so the ranking held.";
