export const FNS = ["engineering", "ai", "product", "design", "data", "operations", "founder"] as const;
export type Fn = (typeof FNS)[number];

export const PERSON_KEYS = ["maya", "ravi", "sam", "lena", "dev"] as const;

/** Every error code the read route answers; the client derives what it recognises from this one list. */
export const READ_ERRORS = ["bad_input", "too_large", "unreadable", "slow_down", "live_off", "bot", "internal"] as const;
export type ReadError = (typeof READ_ERRORS)[number];

export type Intake = { targets: Fn[]; places: string[]; why: string; seniority?: "intern" | "new_grad"; founding?: boolean };

export type Profile = {
  firstName: string;
  headline: string;
  functions: Fn[];
  seniority: "intern" | "new_grad" | "junior" | "mid" | "senior";
  skills: string[];
  shipped: string[];
  locations: string[];
  remoteOk: boolean;
  founderSignal: { score: number; evidence: string[] };
  source: "model" | "rules" | "sample";
};

/** `date` is ISO 8601. */
export type InboxEmail = { id: string; from: string; subject: string; body: string; date: string };

export type EventKind =
  | "applied"
  | "assessment"
  | "screen"
  | "interview"
  | "offer"
  | "rejection"
  | "intro"
  | "noreply"
  | "other";

export type Lane = "jobs" | "founder";

export type InboxEvent = {
  emailId: string;
  company: string;
  role: string | null;
  kind: EventKind;
  date: string;
  lane: Lane;
};

export type Stage = "applied" | "assessment" | "screen" | "interview" | "offer";
export type Exit = "open" | "rejected" | "noreply";

export type AppRow = {
  company: string;
  role: string | null;
  lane: Lane;
  furthest: Stage;
  exit: Exit;
  /** The first application email's date; null when the row began with a later email (an invite with no application on file). */
  appliedAt: string | null;
  lastEventAt: string;
  next: string | null;
};

export type Pipeline = {
  rows: AppRow[];
  stats: { applied: number; inProcess: number; offers: number };
};

export type PersonKey = (typeof PERSON_KEYS)[number];

export type BoardCard = "today" | "intros" | "tools";

export type Person = {
  key: PersonKey;
  resumeText: string;
  intake: Intake;
  volume: number;
  cadence: "on-change" | "daily" | "digest";
  profile: Profile;
};
