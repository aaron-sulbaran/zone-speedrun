import type { SnapshotCompany, SnapshotRole } from "./snapshot";

// Small text helpers for the matcher: articles, title cleanup, place and AI tests.

export const AI_WORDS = /\b(ai|a\.i\.|ml|machine learning|llms?|language models?|generative|neural|deep learning|nlp|computer vision|gpt)\b/i;
export const FOREIGN =
  /europe|emea|\buk\b|united kingdom|london|lisbon|portugal|germany|munich|berlin|dublin|ireland|asia|apac|singapore|india|japan|australia|sydney|latin america|latam|brazil|argentina|colombia|belgrade|serbia|makati|philippines|abu dhabi|uae|middle east|africa/i;
export const STOPWORDS = new Set([
  "that", "with", "where", "team", "teams", "role", "work", "real", "build", "small", "have", "from", "into", "they",
  "ships", "shipped", "close", "back", "like", "want", "looking", "software", "engineer", "engineering", "internship",
  "summer", "product", "design", "user", "users", "code", "their", "which", "about", "great", "while", "using",
]);
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "a UX Designer", "an SRE", "a Unity role", "an AI Engineer". */
export function withArticle(title: string): string {
  const first = title.split(/[\s,/(-]+/)[0] ?? "";
  let an: boolean;
  if (/^[A-Z]{2,5}$/.test(first)) an = "AEFHILMNORSX".includes(first[0]);
  else if (/^(uni|use|usa|ubi|uti|eu)/i.test(first)) an = false;
  else an = /^[aeiou]/i.test(first) || /^i[A-Z]/.test(first);
  return `${an ? "an" : "a"} ${title}`;
}

/** Drops the company tail and remote tags: "New Grad - Quora (Remote)" becomes "New Grad". */
export function cleanTitle(title: string, companyName: string): string {
  const firstWord = companyName.split(/[\s(]/)[0]?.toLowerCase() ?? "";
  let t = title.trim().replace(/\s+/g, " ").replace(/\s*\((remote|hybrid|on-?site)\)/gi, "");
  t = t.replace(/\s+[-\u2013|]\s+(.*)$/, (m, tail: string) =>
    (firstWord && tail.toLowerCase().includes(firstWord)) || /^(remote|hybrid|on-?site)$/i.test(tail.trim()) ? "" : m,
  );
  return t.trim();
}

export function hits(terms: string[], text: string): string[] {
  const lower = text.toLowerCase();
  return terms.filter((t) => new RegExp(`(^|[^a-z0-9])${escapeRegex(t.toLowerCase())}([^a-z0-9]|$)`).test(lower));
}

export const PLACE_ALIASES: Record<string, RegExp> = {
  "san francisco": /(?<!south )san francisco|\bsf\b|bay area|union square/i,
  "new york": /new york|\bnyc\b|manhattan|brooklyn/i,
  "los angeles": /los angeles|\bla\b|santa monica|venice|el segundo/i,
};
export function placeMatches(place: string, location: string | null): boolean {
  if (!location) return false;
  const key = place.trim().toLowerCase();
  const alias = PLACE_ALIASES[key];
  return alias ? alias.test(location) : location.toLowerCase().includes(key);
}

/** First city, or the one the visitor named, plus "and N more" for multi-city strings. */
export function shortLocation(location: string, place: string): string {
  const parts = location.split(/\s*[\u2022;|]\s*|\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return location.trim();
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

