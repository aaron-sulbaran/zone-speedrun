import { speedrunCopy } from "@/lib/content/speedrun";
import { escapeRegex, hits } from "./matchText";
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
  "ship shipp ships back build work team teams role real small thing things great good code ship ships shipped quickly close sit talk fast help looking able using".split(" "),
);
/** Everyday English that says nothing about a field. Never evidence for an own-words line. */
export const COMMON_WORDS = new Set(
  `company companies business businesses startup startups team teams work works worked working job jobs role roles position positions
  people person user users customer customers client clients member members friend friends folks product products service services
  thing things stuff time times day days week weeks month months year years way ways part parts place places home world life kind type
  lot lots end start number numbers group groups level levels problem problems question questions answer answers answered answering
  idea ideas opportunity experience experiences career careers project projects piece pieces side hat hats school class classes course
  courses student students campus night nights weekend weekends morning hour hours minute minutes percent source sources version versions
  note notes flow study future impact mission value values culture office area market industry space field need needs goal goals result
  results change changes changed changing process plan plans case cases point points word words name names page site list lists
  new old good great best better big small large real first last next own other same different many much few every high low long short
  full open close closed free hard easy fast quick early late able ready sure right left whole main key core top public local global
  modern simple clear strong meaningful plain shared
  build builds built building make makes making use uses used using gets getting give gives gave given take takes took go goes went come
  comes came see sees saw seen look looks looked find finds found know knows knew think thinks thought wanted needed likes liked love
  loves loved try tries tried run runs ran running keep keeps kept let lets put puts set sets show shows showed shown call calls called
  ask asks asked tell tells told move moves moved turn turns turned save saves saved compare compares compared check checks checked
  add adds added grow grows grew grown growth learn learns learned own owns owned launch launches launched care cares live lives help
  helps helped helping create creates created support supports supported serve serves served manage manages managed read reads write
  writes wrote written flag flags handle handles handled drive drives drove join joins joined bring brings brought offer offers offered
  provide provides provided include includes included allow allows solve solves solved deliver delivers delivered focus focused
  still even really less only now today soon ago always never often well across around through within without`.split(/\s+/),
);
const SHIPPED_GENERIC = new Set("tool app suite library assistant prototype pilots project system platform redesign".split(" "));
/** Tech and domain terms: an own-words line needs one of these or one of the visitor's skills. "Software" alone is too broad. */
const DOMAIN = new Set(
  `ai ml api apis ios android llm llms nlp sql web mobile cloud devops security data research payments fintech health healthcare
  clinical medical robotics hardware infrastructure backend frontend fullstack firmware embedded kubernetes distributed
  compilers database databases search retrieval evaluation evals model models inference agents agent prompts prompt python typescript
  javascript react rust golang java swift kotlin ux ui accessibility figma prototyping defense aerospace energy climate biotech crypto
  blockchain gaming games education edtech legal insurance logistics analytics bookkeeping accounting pricing billing invoices invoicing
  deploy deploys deployment deployments rollback observability monitoring reliability sre qa automation graphics motion audio video`.split(/\s+/),
);

/** Every flagged reason is in the visitor's own words, with the words it rests on, so the ranker can cap repeats. */
export const ownWords = new WeakMap<Reason, { points: number; words: string[] }>();

const tokens = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}+#]+/gu) ?? [];
const stem = (w: string): string => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w.replace(/s$/, ""));
const isGeneric = (w: string): boolean => GENERIC.has(w) || GENERIC.has(stem(w));
const isCommon = (w: string): boolean => STOP.has(w) || COMMON_WORDS.has(w) || COMMON_WORDS.has(stem(w)) || isGeneric(w);
const isDomain = (w: string): boolean => DOMAIN.has(w) || DOMAIN.has(stem(w));
const stems = (text: string): Set<string> => new Set(tokens(text).map(stem));

type Field = { cite: "title" | "excerpt" | "blurb"; text: string; where: string };

/** The listing's fields with the company's own name taken out, so "Carrow Health" alone never reads as health work. */
function fieldsOf(role: SnapshotRole | null, company: SnapshotCompany | undefined): Field[] {
  const names = [role?.company, company?.name].filter((n): n is string => !!n && n.trim().length > 1);
  const strip = (text: string) => names.reduce((acc, n) => acc.replace(new RegExp(escapeRegex(n.trim()), "gi"), " "), text);
  return [
    { cite: "title" as const, text: strip(role?.title ?? ""), where: "the title" },
    { cite: "excerpt" as const, text: strip(role?.excerpt ?? ""), where: "the description" },
    { cite: "blurb" as const, text: strip(company?.blurb ?? ""), where: "the company blurb" },
  ].filter((f) => f.text.trim());
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
  const skillStems = new Set(profile.skills.flatMap(tokens).filter((w) => !isCommon(w)).map(stem));
  const strong = (w: string) => isDomain(w) || skillStems.has(stem(w));
  const whyWords = [...new Set(tokens(intake.why).filter((w) => w.length >= 2 && !isCommon(w) && !/^\d+$/.test(w)))];

  let score = 0;
  for (const field of fields) {
    const present = stems(field.text);
    const found = whyWords.filter((w) => present.has(stem(w)));
    // A shared everyday word is not a match: the line needs a skill or a domain term.
    if (!found.some(strong)) continue;
    const words = [...found.filter(strong), ...found.filter((w) => !strong(w))];
    const reason: Reason = { text: copy.why(phraseFor(intake.why, words)), cites: [field.cite] };
    ownWords.set(reason, { points: found.length * 0.5, words });
    reasons.push(reason);
    score += found.length * 0.5;
    break;
  }

  shipped: for (const item of profile.shipped) {
    // "Name (what it does)": the name is shown, the description words are matched.
    const [name, ...rest] = item.split(" (");
    const nameTokens = new Set(rest.length > 0 ? tokens(name) : []);
    // Plain nouns or terms only: no everyday words, no past tenses or adverbs ("built", "quickly").
    const words = tokens(item)
      .filter((w) => w.length >= 3 && !isCommon(w) && !SHIPPED_GENERIC.has(w) && !nameTokens.has(w))
      .filter((w) => strong(w) || !/(ed|ly)$/.test(w))
      .sort((a, b) => Number(strong(b)) - Number(strong(a)));
    for (const field of fields) {
      const present = stems(field.text);
      const word = words.find((w) => present.has(stem(w)));
      if (word) {
        const reason: Reason = { text: copy.shipped(name, word, field.where), cites: [field.cite] };
        ownWords.set(reason, { points: 0, words: [word] });
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
