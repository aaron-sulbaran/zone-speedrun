import type { SnapshotCompany, SnapshotRole } from "./snapshot";
import type { Fn, Profile } from "./types";

// Small text helpers for the matcher: articles, title cleanup, place and AI tests.

export const AI_WORDS = /\b(ai|a\.i\.|ml|machine learning|llms?|language models?|generative|neural|deep learning|nlp|computer vision|gpt)\b/i;
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "a UX Designer", "an SRE", "a Unity role", "an AI Engineer". */
export function withArticle(title: string): string {
  const first = title.split(/[\s,/(-]+/)[0] ?? "";
  let an: boolean;
  if (/^[A-Z][A-Z&]{1,5}$/.test(first)) an = "AEFHILMNORSX".includes(first[0]);
  else if (/^(uni|use|usa|ubi|uti|eu)/i.test(first)) an = false;
  else an = /^[aeiou]/i.test(first) || /^i[A-Z]/.test(first);
  return `${an ? "an" : "a"} ${title}`;
}

/**
 * Drops the company tail, pipe tails and remote tags: "New Grad - Quora (Remote)" becomes "New Grad", and
 * "Growth PM, Future Platforms | Housing" becomes "Growth PM, Future Platforms".
 */
export function cleanTitle(title: string, companyName: string): string {
  const firstWord = companyName.split(/[\s(]/)[0]?.toLowerCase() ?? "";
  const isCompany = (part: string) => !!firstWord && part.toLowerCase().includes(firstWord);
  let t = title
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\((remote|hybrid|on-?site)\)/gi, "")
    .replace(/\s*[(\[]\s*(req\.?\s*)?#?[A-Z]{0,3}-?\d{3,}\s*[)\]]/gi, "")
    .replace(/\s+#\d{3,}\b/g, "");
  // Between pipes, the title is the first part that is not the company or a work-place tag.
  const parts = t.split(/\s+\|\s+/);
  t = parts.find((part) => !isCompany(part) && !/^(remote|hybrid|on-?site)$/i.test(part.trim())) ?? parts[0];
  t = t.replace(/\s+[-\u2013]\s+(.*)$/, (m, tail: string) =>
    isCompany(tail) || /^(remote|hybrid|on-?site)$/i.test(tail.trim()) ? "" : m,
  );
  return t.trim();
}

/** Whole-word matches only. Terms of three letters or fewer ("Go", "C", "SQL") are case-sensitive. */
export function hits(terms: string[], text: string): string[] {
  return terms.filter((t) => {
    const flags = t.length <= 3 ? "" : "i";
    return new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(t)}([^A-Za-z0-9]|$)`, flags).test(text);
  });
}

// "LA" is case-sensitive and never a state code after a city ("Franklin, LA", "Baton Rouge LA"); Venice only
// when no other state or country follows it ("Venice, Italy", "Venice Italy").
const LOS_ANGELES = new RegExp(
  [
    "[Ll]os [Aa]ngeles|LOS ANGELES|\\bL\\.A\\.",
    "(?<!,\\s*)(?<!\\b(?!(Remote|Hybrid|Onsite|Greater|Downtown)\\b)[A-Z][a-z]+\\s+)\\bLA\\b(?!\\s*,\\s*(?!CA\\b|California\\b)[A-Za-z])",
    "[Ss]anta [Mm]onica|SANTA MONICA|[Ee]l [Ss]egundo|EL SEGUNDO",
    "[Vv]enice(?!\\s*,\\s*(?!CA\\b|California\\b)[A-Za-z])(?!\\s+(?!CA\\b|California\\b|Beach\\b|Blvd\\b|Boulevard\\b)[A-Z])",
  ].join("|"),
);
// Union Square counts for San Francisco only when the location does not name New York.
const SAN_FRANCISCO =
  /(?<!south )san francisco|\bsf\b|bay area|(?<!(new york|nyc|manhattan).*)union square(?!.*(new york|nyc|manhattan))/i;
const NEW_YORK = /new york|\bnyc\b|manhattan|brooklyn/i;
export const PLACE_ALIASES: Record<string, RegExp> = {
  "san francisco": SAN_FRANCISCO, sf: SAN_FRANCISCO, "bay area": SAN_FRANCISCO,
  "new york": NEW_YORK, nyc: NEW_YORK, "new york city": NEW_YORK,
  "los angeles": LOS_ANGELES, la: LOS_ANGELES, "l.a.": LOS_ANGELES,
  london: /(?<!new )\blondon\b/i,
  dublin: /\bdublin\b(?!,?\s*(ca\b|california|oh\b|ohio))/i,
};
export function placeMatches(place: string, location: string | null): boolean {
  if (!location) return false;
  const key = place.trim().toLowerCase();
  if (!key) return false;
  const alias = PLACE_ALIASES[key];
  return alias ? alias.test(location) : new RegExp(`(^|[^a-z])${escapeRegex(key)}([^a-z]|$)`, "i").test(location);
}

export const isUsStateName = (s: string): boolean => STATE_NAMES_EXACT.test(s.trim());

const STATE_NAMES =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)\b/i;
const STATE_NAMES_EXACT = new RegExp(`^(${STATE_NAMES.source.slice(3, -3)}|georgia)$`, "i");
const STATE_CODES =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const US_CITIES =
  /\b(san francisco|sf bay|bay area|new york|nyc|manhattan|brooklyn|austin|seattle|boston|chicago|los angeles|denver|boulder|atlanta|miami|dallas|houston|san diego|san jose|palo alto|mountain view|sunnyvale|menlo park|san mateo|redwood city|oakland|portland|philadelphia|pittsburgh|nashville|salt lake city|santa monica|costa mesa|torrance|el segundo|union square)\b/i;
const GENERIC_REMOTE =
  /^(fully\s+)?(remote|anywhere)\b(\s*(or|\/)\s*hybrid)?[\s\-\u2013,(]*(multiple locations|anywhere|us|usa|u\.s\.|united states|north america|(pst|est|cst|mst|pt|et|ct|mt)(\s+(working\s+)?(hours|time(zone)?))?)?[)\s]*$/i;

/** A remote role fits a US visitor when it is blank, generic, or names the US, a US state or city, or North America. */
export function remoteFitsUs(location: string | null, places: string[]): boolean {
  const loc = (location ?? "").trim();
  if (!loc) return true;
  if (places.some((p) => !/^remote$/i.test(p.trim()) && placeMatches(p, loc))) return true;
  return (
    GENERIC_REMOTE.test(loc) ||
    /\b(united states|usa|u\.s\.|north america)\b/i.test(loc) ||
    /\bUS\b/.test(loc) ||
    STATE_NAMES.test(loc) ||
    (/\bgeorgia\b/i.test(loc) && !/tbilisi|batumi|kutaisi|caucasus|europe/i.test(loc)) ||
    STATE_CODES.test(loc) ||
    US_CITIES.test(loc)
  );
}

/** First city, or the one the visitor named, plus "and N more" for multi-city strings. */
export function shortLocation(location: string, place: string): string {
  // "New York, NY Menlo Park, CA" is two cities; "San Francisco, CA Hybrid" and "Washington, DC Metro Area" are one.
  const parts = location.split(/\s*[\u2022;|]\s*|\s+\/\s+|(?<=,\s?[A-Z]{2})\s+(?=[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s?[A-Z]{2}\b)/).map((p) => p.trim()).filter((p) => p && !/^(united states|usa|us|u\.s\.)$/i.test(p));
  if (parts.length <= 1) return parts[0] ?? location.trim();
  const chosen = parts.find((p) => placeMatches(place, p)) ?? parts[0];
  return `${chosen} and ${parts.length - 1} more`;
}

/** Where AI shows up: the title, the description, or only the company blurb. Company names never count. */
export function aiStrength(role: SnapshotRole, company: SnapshotCompany | undefined): "title" | "excerpt" | "blurb" | null {
  const names = [role.company, company?.name, ...role.company.split(/[()]/)].filter((n): n is string => !!n && n.trim().length > 1);
  const strip = (text: string) => names.reduce((acc, n) => acc.replace(new RegExp(escapeRegex(n.trim()), "gi"), " "), text);
  if (AI_WORDS.test(strip(role.title))) return "title";
  if (AI_WORDS.test(strip(role.excerpt))) return "excerpt";
  return AI_WORDS.test(strip(company?.blurb ?? "")) ? "blurb" : null;
}


export function dayOf(postedAt: string): number {
  const t = Date.parse(postedAt.length === 10 ? `${postedAt}T00:00:00Z` : postedAt);
  return Number.isNaN(t) ? 0 : t;
}

// A plain "Product Manager" or "Associate Product Manager" is not senior; any other manager is.
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|director|head|vp|chief|founding)\b/i;
const MANAGER = /\bmanager\b/i;
const PRODUCT_MANAGER = /(?<!group )\bproduct manager\b/i;
const NEW_GRAD_TITLE = /new grad|early career|graduate|associate|\b2027\b/i;

/** 0 intern, 1 new grad or junior, 2 unlabeled, 3 senior, 4 staff, founding or exec. */
export function levelOf(role: SnapshotRole): number {
  switch (role.seniority) {
    case "intern": return 0;
    case "junior": return 1;
    case "senior": return 3;
    case "staff":
    case "founding":
    case "exec": return 4;
    default:
      if (/intern/i.test(role.title)) return 0;
      if (NEW_GRAD_TITLE.test(role.title)) return 1;
      if (SENIOR_TITLE.test(role.title)) return 3;
      return MANAGER.test(role.title) && !PRODUCT_MANAGER.test(role.title) ? 3 : 2;
  }
}

export const MTS_TITLE = /member of technical staff|\bmts\b|\btech(nical)? lead\b/i;

export function titleFits(role: SnapshotRole, fn: Fn): boolean {
  const t = role.title;
  switch (fn) {
    case "design": return /design/i.test(t);
    case "founder": return /founding/i.test(t);
    case "product": return /product|\bPM\b/i.test(t);
    case "operations": return /operations|\bops\b/i.test(t);
    case "ai": return AI_WORDS.test(t);
    case "data": return /data|analytics|analyst/i.test(t);
    case "engineering": return /engineer|developer/i.test(t) || MTS_TITLE.test(t);
  }
}

const LEVEL_TITLE: Partial<Record<Profile["seniority"], RegExp>> = {
  intern: /\bintern(ship)?s?\b/i,
  new_grad: /new grad|new graduate|early career|university grad|recent grad/i,
  junior: /\bjunior\b|\bjr\b|entry.level|early career/i,
};
/** The title names the visitor's own level: "New Grad" for a new grad, "Intern" for an intern. */
export const namesLevel = (role: SnapshotRole, seniority: Profile["seniority"]): boolean =>
  LEVEL_TITLE[seniority]?.test(role.title) ?? false;
