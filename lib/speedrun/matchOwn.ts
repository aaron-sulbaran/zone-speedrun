import { speedrunCopy } from "@/lib/content/speedrun";
import { hits } from "./matchText";
import type { Reason } from "./match";
import type { SnapshotCompany, SnapshotRole } from "./snapshot";
import type { Intake, Profile } from "./types";

// Reasons in the visitor's own words: skills from the resume, a phrase from their
// answer, something they shipped. Whole-word matching on stems, never substrings.

const copy = speedrunCopy.matches.reasons;

const STOP = new Set(
  "a an the and or but of to in on at for with from into by as is are was be been it its i me my we our you your they their this that these those there here where when who what which while than then so if not no do does did have has had can could would should will just very more most some any each over about also all one two get got make made want wants like need me".split(" "),
);
const GENERIC = new Set(
  "back build work team teams role real small thing things great good code ship ships shipped quickly close sit talk fast help looking able using".split(" "),
);
const SHIPPED_GENERIC = new Set("tool app suite library assistant prototype pilots project system platform redesign".split(" "));
const DOMAIN = new Set(
  "ai ml api apis ios android llm llms sql web mobile cloud devops security data research payments fintech health healthcare robotics hardware infrastructure growth customers customer users founders design engineering".split(" "),
);

/** Every flagged reason is one of the visitor's own words, so the ranker can cap repeats. */
export const ownWords = new WeakSet<Reason>();

const tokens = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}+#]+/gu) ?? [];
const stem = (w: string): string => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w.replace(/s$/, ""));
const stems = (text: string): Set<string> => new Set(tokens(text).map(stem));

type Field = { cite: "title" | "excerpt" | "blurb"; text: string; where: string };

function fieldsOf(role: SnapshotRole | null, company: SnapshotCompany | undefined): Field[] {
  return [
    { cite: "title" as const, text: role?.title ?? "", where: "the title" },
    { cite: "excerpt" as const, text: role?.excerpt ?? "", where: "the description" },
    { cite: "blurb" as const, text: company?.blurb ?? "", where: "the company blurb" },
  ].filter((f) => f.text);
}

function phraseFor(why: string, hitWords: string[]): string {
  const clauses = why.split(/[.;:,]\s*/).filter(Boolean);
  const clause = clauses.find((c) => stems(c).has(stem(hitWords[0]))) ?? why;
  const text = clause.trim();
  return text.length > 70 ? `${text.slice(0, 70).replace(/\s+\S*$/, "")}...` : text;
}

export function personalReasons(
  profile: Profile, intake: Intake, role: SnapshotRole | null, company: SnapshotCompany | undefined,
): { reasons: Reason[]; score: number } {
  const reasons: Reason[] = [];
  const fields = fieldsOf(role, company);
  const skillTokens = new Set(profile.skills.flatMap(tokens).map(stem));
  const whyWords = [...new Set(tokens(intake.why).filter((w) => w.length >= 2 && !STOP.has(w) && !GENERIC.has(w) && !GENERIC.has(stem(w)) && !/^\d+$/.test(w)))];

  let score = 0;
  for (const field of fields) {
    const present = stems(field.text);
    const found = whyWords.filter((w) => present.has(stem(w)));
    const meaningful = found.some((w) => DOMAIN.has(w) || skillTokens.has(stem(w)));
    if (found.length >= 2 || meaningful) {
      const reason: Reason = { text: copy.why(phraseFor(intake.why, found)), cites: [field.cite] };
      ownWords.add(reason);
      reasons.push(reason);
      score += found.length * 0.5;
      break;
    }
  }

  shipped: for (const item of profile.shipped) {
    const words = tokens(item).filter((w) => w.length >= 3 && !STOP.has(w) && !GENERIC.has(w) && !SHIPPED_GENERIC.has(w));
    for (const field of fields) {
      const present = stems(field.text);
      const word = words.find((w) => present.has(stem(w)));
      if (word) {
        const reason: Reason = { text: copy.shipped(item, word, field.where), cites: [field.cite] };
        ownWords.add(reason);
        reasons.push(reason);
        break shipped;
      }
    }
  }

  const title = role?.title ?? "";
  const excerpt = role?.excerpt ?? "";
  const blurb = company?.blurb ?? "";
  const inTitle = hits(profile.skills, title);
  const inExcerpt = hits(profile.skills, excerpt).filter((s) => !inTitle.includes(s));
  const inBlurb = hits(profile.skills, blurb).filter((s) => !inTitle.includes(s) && !inExcerpt.includes(s));
  score += Math.min(6, inTitle.length * 3 + inExcerpt.length * 1.5 + inBlurb.length);
  if (inTitle.length > 0) reasons.push({ text: copy.skillsTitle(inTitle.join(" and ")), cites: ["skills", "title"] });
  if (inExcerpt.length > 0) reasons.push({ text: copy.skillsExcerpt(inExcerpt.slice(0, 3).join(", ")), cites: ["skills", "excerpt"] });
  if (inBlurb.length > 0) reasons.push({ text: copy.skillsBlurb(inBlurb.slice(0, 3).join(", ")), cites: ["skills", "blurb"] });
  return { reasons, score: Math.min(6, score) };
}
