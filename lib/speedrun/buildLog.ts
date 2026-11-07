import { speedrunCopy } from "@/lib/content";
import type { MatchResult } from "./match";
import type { Intake, Profile } from "./types";

export type BuildLine = { at: number; text: string; tone: "read" | "narrow" | "made" };

const copy = speedrunCopy.build.lines;
const WHY_MAX = 60;
const MIN_GAP_MS = 340;
const MAX_GAP_MS = 800;
const GAP_PER_CHAR_MS = 14;

/** Up to 60 characters of the visitor's why, cut at a word edge. */
function whyFragment(why: string): string {
  const clean = why.trim().replace(/\s+/g, " ");
  if (clean.length <= WHY_MAX) return clean;
  const cut = clean.slice(0, WHY_MAX);
  const space = cut.lastIndexOf(" ");
  return (space > 20 ? cut.slice(0, space) : cut).replace(/[,.;:\s]+$/, "");
}

/** The lines the build panel types, in order. Times are start offsets in ms. */
export function composeBuildLog(intake: Intake, profile: Profile, result: MatchResult): BuildLine[] {
  const labels = speedrunCopy.matches.fnLabels;
  const { narrowing } = result;
  const drafts: Omit<BuildLine, "at">[] = [{ text: copy.answers, tone: "read" }];
  if (intake.targets.length > 0) drafts.push({ text: copy.targets(intake.targets.map((t) => labels[t]).join(", ")), tone: "read" });
  if (intake.places.length > 0) drafts.push({ text: copy.places(intake.places.join(", ")), tone: "read" });
  if (intake.why.trim()) drafts.push({ text: copy.why(whyFragment(intake.why)), tone: "read" });
  drafts.push({ text: copy.resume, tone: "read" });
  if (profile.skills.length > 0) drafts.push({ text: copy.found(profile.skills.slice(0, 3).join(", ")), tone: "read" });
  drafts.push(
    { text: copy.scanning(narrowing.companies, narrowing.roles), tone: "narrow" },
    { text: copy.fit(narrowing.afterFilters), tone: "narrow" },
    { text: copy.worth(narrowing.shown), tone: "narrow" },
    { text: speedrunCopy.build.madeFor(profile.firstName), tone: "made" },
  );
  let at = 0;
  return drafts.map((draft) => {
    const line = { ...draft, at };
    at += Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, draft.text.length * GAP_PER_CHAR_MS));
    return line;
  });
}
