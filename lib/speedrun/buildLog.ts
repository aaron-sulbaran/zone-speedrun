import { speedrunCopy } from "@/lib/content/speedrun";
import type { MatchResult } from "./match";
import type { Intake, Profile } from "./types";

/** `at` is the start offset in ms, `typeMs` how long the line takes to type. */
export type BuildLine = { at: number; text: string; tone: "read" | "narrow" | "made"; typeMs: number };

const copy = speedrunCopy.build.lines;
const WHY_MAX = 60;
const CHARS_PER_SECOND = 45;
const PAUSE_MS = 150;
export const BAR_DELAY_MS = 150;
export const BAR_FILL_MS = 700;
export const HOLD_MS = 600;
const TAIL_MS = BAR_DELAY_MS + BAR_FILL_MS + HOLD_MS;
const MIN_END_MS = 6200;
const MAX_END_MS = 7800;

/** Up to 60 characters of the visitor's why, cut at a word edge, with an ellipsis when cut. */
function whyFragment(why: string): string {
  const clean = why.trim().replace(/\s+/g, " ");
  if (clean.length <= WHY_MAX) return clean;
  const cut = clean.slice(0, WHY_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[,.;:\s]+$/, "")}...`;
}

/** The whole beat: the lines, the bar fill and the hold, in ms. */
export function timingFor(lines: BuildLine[]) {
  const last = lines[lines.length - 1];
  const barStart = last ? last.at + last.typeMs + BAR_DELAY_MS : 0;
  const barEnd = barStart + BAR_FILL_MS;
  return { barStart, barEnd, end: barEnd + HOLD_MS };
}

/** The lines the build panel types, in order, paced so the beat lands between 6 and 8 s. */
export function composeBuildLog(
  intake: Intake, profile: Profile, result: MatchResult, who: { name: string; sampleOwner: string | null },
): BuildLine[] {
  const labels = speedrunCopy.matches.fnLabels;
  const { narrowing } = result;
  const drafts: Pick<BuildLine, "text" | "tone">[] = [];
  if (who.sampleOwner !== null && who.sampleOwner !== who.name) drafts.push({ text: copy.sample(who.sampleOwner), tone: "read" });
  if (intake.targets.length > 0) drafts.push({ text: copy.targets(intake.targets.map((t) => labels[t]).join(", ")), tone: "read" });
  if (intake.places.length > 0) drafts.push({ text: copy.places(intake.places.join(", ")), tone: "read" });
  if (intake.why.trim()) drafts.push({ text: copy.why(whyFragment(intake.why)), tone: "read" });
  if (profile.skills.length >= 2) drafts.push({ text: copy.found(profile.skills.slice(0, 3).join(", ")), tone: "read" });
  drafts.push(
    { text: copy.scanning(narrowing.companies, narrowing.speedrunRoles, narrowing.a16zRoles), tone: "narrow" },
    { text: copy.fit(narrowing.afterFilters), tone: "narrow" },
    { text: copy.worth(narrowing.shown), tone: "narrow" },
    { text: speedrunCopy.build.madeFor(who.name), tone: "made" },
  );
  const naturalTyping = drafts.reduce((sum, d) => sum + (d.text.length / CHARS_PER_SECOND) * 1000, 0);
  const pauses = (drafts.length - 1) * PAUSE_MS;
  const naturalEnd = naturalTyping + pauses + TAIL_MS;
  const end = Math.min(MAX_END_MS, Math.max(MIN_END_MS, naturalEnd));
  // Typing speeds up or slows down so the whole beat lands on `end`.
  const scale = (end - TAIL_MS - pauses) / naturalTyping;
  let at = 0;
  return drafts.map((draft) => {
    const typeMs = (draft.text.length / CHARS_PER_SECOND) * 1000 * scale;
    const line = { ...draft, at, typeMs };
    at += typeMs + PAUSE_MS;
    return line;
  });
}
