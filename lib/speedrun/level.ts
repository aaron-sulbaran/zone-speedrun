import { speedrunCopy } from "@/lib/content/speedrun";
import { ARRANGEMENTS } from "./onboarding";
import type { SnapshotRole } from "./snapshot";
import type { Intake, Profile } from "./types";

export type LevelWord = "new grad" | "co-op" | "intern" | "early career" | "entry level" | "junior";

export type LevelNote =
  | { kind: "says"; source: "title" | "tag" | "listing"; word: LevelWord }
  | { kind: "asksYears"; years: number }
  | { kind: "unstated"; read: boolean };

type EarlyWord = Exclude<LevelWord, "junior">;

// Whole words only, so "Internal Tools" and "International Sales" never read as an internship.
const EARLY_PHRASES: [EarlyWord, RegExp][] = [
  ["new grad", /\b(?:new|recent|university)[\s-]grad(?:uate)?s?\b|\bclass of 20\d\d\b|\b20\d\d[\s-]grads?\b/i],
  ["co-op", /\bco-?ops?\b/i],
  ["intern", /\binterns?\b|\binternships?\b/i],
  ["early career", /\bearly[\s-]career\b/i],
  ["entry level", /\bentry[\s-]level\b/i],
];

// "3-5 years of experience" and "5+ years of professional experience" both count; a bare "years" does not.
const YEARS = /\b(\d{1,2})\s*(?:\+|[-–]\s*\d{1,2}|to\s+\d{1,2})?\s*years?\b[^.]{0,40}\bexperience/gi;

function earlyWord(text: string): EarlyWord | null {
  return EARLY_PHRASES.find(([, phrase]) => phrase.test(text))?.[0] ?? null;
}

function smallestYears(hints: string[]): number | null {
  const years = hints.flatMap((hint) => [...hint.matchAll(YEARS)].map((m) => Number(m[1]))).filter((n) => n >= 2);
  return years.length > 0 ? Math.min(...years) : null;
}

export function levelNote(role: SnapshotRole): LevelNote {
  const inTitle = earlyWord(role.title);
  if (inTitle) return { kind: "says", source: "title", word: inTitle };
  if (role.seniority === "intern" || role.seniority === "junior") return { kind: "says", source: "tag", word: role.seniority };
  for (const hint of role.levelHints) {
    const word = earlyWord(hint);
    if (word) return { kind: "says", source: "listing", word };
  }
  const years = smallestYears(role.levelHints);
  if (years !== null) return { kind: "asksYears", years };
  return { kind: "unstated", read: role.descriptionRead };
}

function joinAsks(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** Who the visitor is looking to be, in their own arrangements when they gave them; null for anyone else. */
export function earlyAsk(profile: Profile, intake: Intake): string | null {
  const names = speedrunCopy.matches.level.asks;
  if (intake.asks && intake.asks.length > 0) {
    return joinAsks(ARRANGEMENTS.filter((a) => intake.asks!.includes(a)).map((a) => names[a]));
  }
  const seniority = intake.seniority ?? profile.seniority;
  if (seniority === "intern") return names.between;
  if (seniority === "new_grad") return names.afterGrad;
  return null;
}
