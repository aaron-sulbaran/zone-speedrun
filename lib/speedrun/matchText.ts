import type { SnapshotCompany, SnapshotRole } from "./snapshot";

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

/** Drops the company tail and remote tags: "New Grad - Quora (Remote)" becomes "New Grad". */
export function cleanTitle(title: string, companyName: string): string {
  const firstWord = companyName.split(/[\s(]/)[0]?.toLowerCase() ?? "";
  let t = title
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\((remote|hybrid|on-?site)\)/gi, "")
    .replace(/\s*[(\[]\s*(req\.?\s*)?#?[A-Z]{0,3}-?\d{3,}\s*[)\]]/gi, "")
    .replace(/\s+#\d{3,}\b/g, "");
  t = t.replace(/\s+[-\u2013|]\s+(.*)$/, (m, tail: string) =>
    (firstWord && tail.toLowerCase().includes(firstWord)) || /^(remote|hybrid|on-?site)$/i.test(tail.trim()) ? "" : m,
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

export const PLACE_ALIASES: Record<string, RegExp> = {
  "san francisco": /(?<!south )san francisco|\bsf\b|bay area|union square/i,
  "new york": /new york|\bnyc\b|manhattan|brooklyn/i,
  "los angeles": /los angeles|\bla\b|santa monica|venice|el segundo/i,
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

const STATE_NAMES =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)\b/i;
const STATE_CODES =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const US_CITIES =
  /\b(san francisco|sf bay|bay area|new york|nyc|manhattan|brooklyn|austin|seattle|boston|chicago|los angeles|denver|boulder|atlanta|miami|dallas|houston|san diego|san jose|palo alto|mountain view|sunnyvale|menlo park|san mateo|redwood city|oakland|portland|philadelphia|pittsburgh|nashville|salt lake city|santa monica|costa mesa|torrance|el segundo|venice|union square)\b/i;
const GENERIC_REMOTE =
  /^(fully\s+)?(remote|anywhere)\b[\s\-\u2013,(]*(multiple locations|anywhere|us|usa|u\.s\.|united states|north america)?[)\s]*$/i;

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
    STATE_CODES.test(loc) ||
    US_CITIES.test(loc)
  );
}

/** First city, or the one the visitor named, plus "and N more" for multi-city strings. */
export function shortLocation(location: string, place: string): string {
  const parts = location.split(/\s*[\u2022;|]\s*|\s+\/\s+/).map((p) => p.trim()).filter((p) => p && !/^(united states|usa|us|u\.s\.)$/i.test(p));
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

