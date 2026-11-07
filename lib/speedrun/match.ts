import type { Snapshot, SnapshotCompany, SnapshotRole } from "./snapshot";
import type { Fn, Intake, Profile } from "./types";

export type Reason = {
  text: string;
  cites: ("title" | "blurb" | "functions" | "location" | "seniority" | "skills" | "excerpt")[];
};

export type Match = {
  company: {
    name: string;
    slug: string | null;
    logo: string | null;
    cohort: string | null;
    stage: string | null;
    blurb: string;
  };
  role: SnapshotRole | null;
  score: number;
  reasons: Reason[];
  connect: ("intro" | "apply" | "follow")[];
};

export type FounderRoute = { kind: "speedrun" | "alpha"; url: string };

export type MatchResult = {
  matches: Match[];
  routes: FounderRoute[];
  narrowing: { companies: number; roles: number; afterFilters: number; shown: number };
};

type Corpus = Pick<Snapshot, "companies" | "roles">;

const FUND_SLUG = "speedrun";
const ROUTES: FounderRoute[] = [
  { kind: "speedrun", url: "https://speedrun.a16z.com/apply" },
  { kind: "alpha", url: "https://speedrun.a16z.com/alpha" },
];

const AI_WORDS = /\b(ai|a\.i\.|ml|machine learning|llms?|language models?|generative|neural|deep learning|nlp)\b/i;
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|manager|director|head|vp|chief|founding)\b/i;
const NEW_GRAD_TITLE = /new grad|early career|graduate|associate|\b2027\b/i;
const STOPWORDS = new Set([
  "that", "with", "where", "team", "role", "work", "real", "build", "small", "have", "from", "into", "they",
  "ships", "shipped", "close", "sit", "back", "like", "want", "looking", "get", "who", "and", "the", "for",
]);

const PLACE_ALIASES: Record<string, RegExp> = {
  "san francisco": /(?<!south )san francisco|\bsf\b|bay area|union square/i,
  "new york": /new york|\bnyc\b|manhattan|brooklyn/i,
  "los angeles": /los angeles|\bla\b|santa monica|venice|el segundo/i,
};

const FN_LABEL: Record<Fn, string> = {
  engineering: "engineering",
  ai: "AI",
  product: "product",
  design: "design",
  data: "data",
  operations: "operations",
  founder: "founding",
};

function withArticle(title: string): string {
  const clean = title.trim().replace(/\s+/g, " ");
  return `${/^[aeiou]/i.test(clean) || /^(ai|ml|llm)\b/i.test(clean) ? "an" : "a"} ${clean}`;
}

function dayOf(postedAt: string): number {
  const t = Date.parse(postedAt.length === 10 ? `${postedAt}T00:00:00Z` : postedAt);
  return Number.isNaN(t) ? 0 : t;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roleHasFn(role: SnapshotRole, company: SnapshotCompany | undefined, fn: Fn): boolean {
  const text = `${role.title} ${role.excerpt} ${company?.blurb ?? ""}`;
  switch (fn) {
    case "engineering":
      return role.fn === "engineering";
    case "ai":
      return (role.fn === "engineering" || role.fn === "research") && AI_WORDS.test(text);
    case "product":
      return role.fn === "product";
    case "design":
      return role.fn === "design" || (/designer/i.test(role.title) && !/industrial|mechanical/i.test(role.title));
    case "data":
      return (role.fn === "engineering" || role.fn === "research" || role.fn === "operations") && /\b(data|analytics|analyst)\b/i.test(role.title);
    case "operations":
      return role.fn === "operations";
    case "founder":
      return (
        (role.seniority === "founding" || /founding/i.test(role.title)) &&
        ["engineering", "product", "design", "research", "operations"].includes(role.fn ?? "") &&
        !/recruiter|sales|marketing/i.test(role.title)
      );
  }
}

function levelOf(role: SnapshotRole): number | null {
  const isIntern = /intern/i.test(role.title);
  switch (role.seniority) {
    case "intern":
      return 0;
    case "junior":
      return 1;
    case "senior":
      return 3;
    case "staff":
    case "founding":
    case "exec":
      return 4;
    default:
      if (isIntern) return 0;
      if (NEW_GRAD_TITLE.test(role.title)) return 1;
      if (SENIOR_TITLE.test(role.title)) return 3;
      return 2;
  }
}

const ALLOWED_LEVELS: Record<Profile["seniority"], number[]> = {
  intern: [0],
  new_grad: [1, 2],
  junior: [1, 2],
  mid: [1, 2, 3],
  senior: [2, 3, 4],
};

function placeMatches(place: string, location: string | null): boolean {
  if (!location) return false;
  const key = place.trim().toLowerCase();
  const alias = PLACE_ALIASES[key];
  return alias ? alias.test(location) : location.toLowerCase().includes(key);
}

function roleIsRemote(role: SnapshotRole): boolean {
  return role.workplace === "Remote" || /remote/i.test(role.location ?? "");
}

function placeFit(places: string[], remoteOk: boolean, role: SnapshotRole): { kind: "city" | "remote"; place: string } | null {
  for (const place of places) {
    if (/^remote$/i.test(place.trim())) continue;
    if (placeMatches(place, role.location)) return { kind: "city", place };
  }
  if ((remoteOk || places.some((p) => /^remote$/i.test(p.trim()))) && roleIsRemote(role)) {
    return { kind: "remote", place: "Remote" };
  }
  return null;
}

function termsFor(profile: Profile, intake: Intake): { skills: string[]; words: string[] } {
  const skills = profile.skills.map((s) => s.trim()).filter(Boolean);
  const words = intake.why
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return { skills, words: [...new Set(words)] };
}

function hits(terms: string[], text: string): string[] {
  return terms.filter((t) => new RegExp(`(^|[^a-z0-9])${escapeRegex(t.toLowerCase())}([^a-z0-9]|$)`).test(text.toLowerCase()));
}

type Scored = { role: SnapshotRole; company: SnapshotCompany | undefined; score: number; reasons: Reason[] };

function scoreRole(
  role: SnapshotRole,
  company: SnapshotCompany | undefined,
  fn: Fn,
  fnIndex: number,
  place: ReturnType<typeof placeFit>,
  terms: ReturnType<typeof termsFor>,
  seniority: Profile["seniority"],
  newest: number,
): Scored {
  const reasons: Reason[] = [];
  let score = fnIndex === 0 ? 5 : 4;

  const titleMatchesFn = fn === "design" ? /design/i.test(role.title) : fn === "founder" ? /founding/i.test(role.title) : fn === "product" ? /product/i.test(role.title) : fn === "operations" ? /operations|ops\b/i.test(role.title) : fn === "ai" ? AI_WORDS.test(role.title) : fn === "data" ? /data|analytics|analyst/i.test(role.title) : /engineer|developer/i.test(role.title);
  reasons.push({
    text: `You said ${FN_LABEL[fn]}, and they are hiring ${withArticle(role.title)}.`,
    cites: titleMatchesFn ? ["functions", "title"] : ["functions"],
  });

  const level = levelOf(role);
  if (role.seniority && level !== null && ALLOWED_LEVELS[seniority].includes(level)) {
    score += 2;
    reasons.push({ text: `The role is listed as ${role.seniority}, which fits where you are.`, cites: ["seniority"] });
  } else if (/intern|new grad|early career/i.test(role.title) && (seniority === "intern" || seniority === "new_grad")) {
    score += 2;
    reasons.push({ text: "The title says it is open to people early in their career.", cites: ["title"] });
  }

  if (place) {
    score += place.kind === "city" ? 1.5 : 1;
    reasons.push({
      text: place.kind === "city" ? `It is based in ${role.location?.trim()}, and you named ${place.place}.` : "It can be done remotely, and you said remote works.",
      cites: ["location"],
    });
  }

  const skillTitle = hits(terms.skills, role.title);
  const skillBody = hits(terms.skills, role.excerpt).filter((s) => !skillTitle.includes(s));
  const skillBlurb = hits(terms.skills, company?.blurb ?? "").filter((s) => !skillTitle.includes(s) && !skillBody.includes(s));
  const wordHits = hits(terms.words, `${role.title} ${role.excerpt}`);
  score += Math.min(6, skillTitle.length * 3 + skillBody.length * 1.5 + skillBlurb.length + wordHits.length * 0.5);
  if (skillTitle.length > 0) {
    reasons.push({ text: `Your ${skillTitle.join(" and ")} shows up in the title.`, cites: ["skills", "title"] });
  }
  if (skillBody.length > 0) {
    reasons.push({ text: `Your ${skillBody.slice(0, 3).join(", ")} comes up in the role description.`, cites: ["skills", "excerpt"] });
  }
  if (skillBlurb.length > 0) {
    reasons.push({ text: `Your ${skillBlurb.slice(0, 3).join(", ")} fits what the company builds.`, cites: ["skills", "blurb"] });
  }

  if (role.tier === "speedrun") score += 1;
  const age = newest - dayOf(role.postedAt);
  score += Math.max(0, 0.5 - age / (1000 * 60 * 60 * 24 * 120));

  return { role, company, score, reasons };
}

function companyOnly(
  company: SnapshotCompany,
  fn: Fn,
  place: string | null,
  terms: ReturnType<typeof termsFor>,
): Scored["reasons"] | null {
  const mapped: Record<Fn, string[]> = {
    engineering: ["engineering"], ai: ["engineering", "research"], product: ["product"], design: ["design"],
    data: ["engineering"], operations: ["operations"], founder: [],
  };
  if (!company.functions.some((f) => mapped[fn].includes(f))) return null;
  if (fn === "ai" && !AI_WORDS.test(company.blurb)) return null;
  const reasons: Reason[] = [{ text: `You said ${FN_LABEL[fn]}, and they hire for ${FN_LABEL[fn]} at ${company.name}.`, cites: ["functions"] }];
  if (place) reasons.push({ text: `They are based in ${company.location}, and you named ${place}.`, cites: ["location"] });
  const blurbSkills = hits(terms.skills, company.blurb);
  if (blurbSkills.length > 0) reasons.push({ text: `Your ${blurbSkills.slice(0, 3).join(", ")} fits what the company builds.`, cites: ["skills", "blurb"] });
  return reasons;
}

function toMatch(scored: Scored): Match {
  const { role, company } = scored;
  return {
    company: {
      name: company?.name ?? role.company,
      slug: company?.slug ?? role.companySlug,
      logo: company?.logo ?? null,
      cohort: company?.cohort ?? role.cohort,
      stage: company?.stage ?? null,
      blurb: company?.blurb ?? "",
    },
    role,
    score: Math.round(scored.score * 100) / 100,
    reasons: scored.reasons,
    connect: ["apply", ...(company ? (["intro"] as const) : []), "follow"],
  };
}

export function rankMatches(profile: Profile, intake: Intake, corpus: Corpus, limit = 6): MatchResult {
  const companies = corpus.companies.filter((c) => c.slug !== FUND_SLUG);
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const roles = corpus.roles.filter((r) => r.companySlug !== FUND_SLUG);

  const targets: Fn[] = intake.targets.length > 0 ? intake.targets : profile.functions;
  // What the visitor typed wins over what the resume implies.
  const places = (intake.places.length > 0 ? intake.places : profile.locations).filter(Boolean);
  const remoteOk = intake.places.length > 0 ? intake.places.some((p) => /^remote$/i.test(p.trim())) : profile.remoteOk;
  const terms = termsFor(profile, intake);
  const allowed = ALLOWED_LEVELS[profile.seniority];
  const newest = roles.reduce((max, r) => Math.max(max, dayOf(r.postedAt)), 0);

  const best = new Map<string, Scored>();
  let afterFilters = 0;
  for (const role of roles) {
    const company = role.companySlug ? bySlug.get(role.companySlug) : undefined;
    const level = levelOf(role);
    if (level === null || !allowed.includes(level)) continue;
    const fnIndex = targets.findIndex((fn) => roleHasFn(role, company, fn));
    if (fnIndex < 0) continue;
    const place = places.length > 0 ? placeFit(places, remoteOk, role) : null;
    if (places.length > 0 && !place) continue;
    afterFilters += 1;
    const scored = scoreRole(role, company, targets[fnIndex], fnIndex, place, terms, profile.seniority, newest);
    const key = role.companySlug ?? role.company.toLowerCase();
    const prior = best.get(key);
    if (!prior || scored.score > prior.score || (scored.score === prior.score && dayOf(role.postedAt) > dayOf(prior.role.postedAt))) {
      best.set(key, scored);
    }
  }

  const matches = [...best.values()]
    .sort((a, b) => b.score - a.score || dayOf(b.role.postedAt) - dayOf(a.role.postedAt) || a.role.id.localeCompare(b.role.id))
    .map(toMatch);

  // Companies with no role that passed the filters still show up, after every
  // role-backed match, when what they build lines up with what was asked for.
  const companyMatches: Match[] = [];
  for (const company of companies) {
    if (best.has(company.slug)) continue;
    const place = places.length > 0
      ? places.find((p) => !/^remote$/i.test(p.trim()) && placeMatches(p, company.location)) ?? null
      : null;
    if (places.length > 0 && !place) continue;
    const fn = targets.find((t) => companyOnly(company, t, place, terms) !== null);
    if (!fn) continue;
    const reasons = companyOnly(company, fn, place, terms);
    if (!reasons) continue;
    companyMatches.push({
      company: { name: company.name, slug: company.slug, logo: company.logo, cohort: company.cohort, stage: company.stage, blurb: company.blurb },
      role: null,
      score: Math.round((1 + reasons.length * 0.5) * 100) / 100,
      reasons,
      connect: ["intro", "follow"],
    });
  }
  companyMatches.sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name));

  const shown = [...matches, ...companyMatches].slice(0, limit);
  return {
    matches: shown,
    routes: profile.founderSignal.score >= 0.6 ? ROUTES : [],
    narrowing: {
      companies: companies.length,
      roles: roles.length,
      afterFilters: afterFilters + companyMatches.length,
      shown: shown.length,
    },
  };
}
