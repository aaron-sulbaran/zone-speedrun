export type Fn = "engineering" | "ai" | "product" | "design" | "data" | "operations" | "founder";

export type Intake = { targets: Fn[]; places: string[]; why: string };

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
  lastEventAt: string;
  next: string | null;
};

export type Pipeline = {
  rows: AppRow[];
  stats: { applied: number; inProcess: number; intros: number; offers: number };
};

export type PersonKey = "maya" | "ravi" | "sam" | "lena" | "dev";

export type BoardCard = "today" | "matches" | "pipeline" | "flow" | "intros" | "tools";

export type Person = {
  key: PersonKey;
  resumeText: string;
  intake: Intake;
  volume: number;
  cadence: "on-change" | "daily" | "digest";
  profile: Profile;
  boardOrder: BoardCard[];
};
