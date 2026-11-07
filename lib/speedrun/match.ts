import { speedrunCopy } from "@/lib/content/speedrun";
import { AI_WORDS, aiStrength, cleanTitle, escapeRegex, placeMatches, remoteFitsUs, shortLocation, withArticle } from "./matchText";
import { ownWords, personalReasons } from "./matchOwn";
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
type Place = { kind: "city" | "remote"; place: string; location: string };

const FUND_SLUG = "speedrun";
const ROUTES: FounderRoute[] = [
  { kind: "speedrun", url: "https://speedrun.a16z.com/apply" },
  { kind: "alpha", url: "https://speedrun.a16z.com/alpha" },
];
const copy = speedrunCopy.matches;

const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|manager|director|head|vp|chief|founding)\b/i;
const NEW_GRAD_TITLE = /new grad|early career|graduate|associate|\b2027\b/i;
const ALLOWED_LEVELS: Record<Profile["seniority"], number[]> = {
  intern: [0], new_grad: [1, 2], junior: [1, 2], mid: [1, 2, 3], senior: [2, 3, 4],
};

function dayOf(postedAt: string): number {
  const t = Date.parse(postedAt.length === 10 ? `${postedAt}T00:00:00Z` : postedAt);
  return Number.isNaN(t) ? 0 : t;
}

function levelOf(role: SnapshotRole): number {
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
      return SENIOR_TITLE.test(role.title) ? 3 : 2;
  }
}

function titleFits(role: SnapshotRole, fn: Fn): boolean {
  const t = role.title;
  switch (fn) {
    case "design": return /design/i.test(t);
    case "founder": return /founding/i.test(t);
    case "product": return /product/i.test(t);
    case "operations": return /operations|\bops\b/i.test(t);
    case "ai": return AI_WORDS.test(t);
    case "data": return /data|analytics|analyst/i.test(t);
    case "engineering": return /engineer|developer/i.test(t);
  }
}

function roleHasFn(role: SnapshotRole, company: SnapshotCompany | undefined, fn: Fn): boolean {
  switch (fn) {
    case "engineering": return role.fn === "engineering";
    case "ai": return (role.fn === "engineering" || role.fn === "research") && aiStrength(role, company) !== null;
    case "product": return role.fn === "product";
    case "design":
      return role.fn === "design" || (/designer/i.test(role.title) && !/industrial|mechanical/i.test(role.title));
    case "data":
      return ["engineering", "research", "operations"].includes(role.fn ?? "") && /\b(data|analytics|analyst)\b/i.test(role.title);
    case "operations": return role.fn === "operations";
    case "founder":
      return (
        (role.seniority === "founding" || /founding/i.test(role.title)) &&
        ["engineering", "product", "design", "research", "operations"].includes(role.fn ?? "") &&
        !/recruiter|sales|marketing/i.test(role.title)
      );
  }
}

const isRemotePlace = (p: string) => /^remote$/i.test(p.trim());

function placeFit(places: string[], remoteOk: boolean, role: SnapshotRole): Place | null {
  for (const place of places) {
    if (!isRemotePlace(place) && placeMatches(place, role.location)) {
      return { kind: "city", place, location: shortLocation(role.location ?? "", place) };
    }
  }
  const remoteFits = remoteOk && (role.workplace === "Remote" || /remote/i.test(role.location ?? ""));
  if (!remoteFits || !remoteFitsUs(role.location, places)) return null;
  return { kind: "remote", place: "Remote", location: role.location ?? "" };
}


type Scored = { role: SnapshotRole; company: SnapshotCompany | undefined; score: number; reasons: Reason[]; tier: number };
type Ctx = { profile: Profile; intake: Intake; newest: number; hardwareSkills: boolean };

const SOFTWARE_TITLE = /software|backend|back-end|frontend|front-end|full.?stack|mobile|\bios\b|android|platform|infrastructure|\bdata\b|\bml\b|machine learning|\bai\b|\bweb\b|cloud|devops|\bsre\b|developer|\bapi\b/i;
const HARDWARE_TITLE = /mechanical|electrical|hardware|systems? engineer|naval|manufactur|embedded|firmware|avionics|propulsion|structur|\bgnc\b|power systems|civil|chemical|\brf\b|thermal|aerospace|test engineer|field engineer|mission/i;
const HARDWARE_SKILL = /firmware|embedded|fpga|pcb|\bcad\b|verilog|vhdl|circuit|mechanical|electrical|solidworks|robotics|\bplc\b/i;

function scoreRole(
  role: SnapshotRole, company: SnapshotCompany | undefined, fn: Fn, fnIndex: number, place: Place | null,
  ctx: Ctx,
): Scored {
  const { profile } = ctx;
  const label = copy.fnLabels[fn];
  const nameForTitle = cleanTitle(role.title, role.company);
  let score = fnIndex === 0 ? 5 : 4;
  const fits = titleFits(role, fn);
  if (fits) score += 2;
  const ai = fn === "ai" ? aiStrength(role, company) : null;
  if (ai === "blurb") score -= 1.5;
  // Software titles lead for engineering and AI targets, unless the resume shows hardware skills.
  if ((fn === "engineering" || fn === "ai") && !ctx.hardwareSkills) {
    if (SOFTWARE_TITLE.test(role.title)) score += 2;
    else if (HARDWARE_TITLE.test(role.title)) score -= 3;
  }
  const reasons: Reason[] = [
    { text: copy.reasons.fnTitle(label, withArticle(nameForTitle)), cites: fits ? ["functions", "title"] : ["functions"] },
  ];
  if (ai === "blurb") reasons.push({ text: copy.reasons.aiBlurb, cites: ["blurb"] });

  const personal = personalReasons(profile, ctx.intake, role, company);
  score += personal.score;
  reasons.push(...personal.reasons);

  const level = levelOf(role);
  if (role.seniority && ALLOWED_LEVELS[profile.seniority].includes(level)) {
    score += 2;
    reasons.push({ text: copy.reasons.seniority(role.seniority), cites: ["seniority"] });
  } else if (/intern|new grad|early career/i.test(role.title) && (profile.seniority === "intern" || profile.seniority === "new_grad")) {
    score += 2;
    reasons.push({ text: copy.reasons.earlyCareer, cites: ["title"] });
  }
  if (place) {
    score += place.kind === "city" ? 1.5 : 1;
    reasons.push({ text: place.kind === "city" ? copy.reasons.city(place.location, place.place) : copy.reasons.remote, cites: ["location"] });
  }
  if (role.tier === "speedrun") score += 1;
  score += Math.max(0, 0.5 - (ctx.newest - dayOf(role.postedAt)) / (1000 * 60 * 60 * 24 * 120));
  // The first target outranks every bonus. For an AI-first visitor that means AI in the title or description.
  const tier = fnIndex === 0 && ai !== "blurb" ? 1 : 0;
  return { role, company, score, reasons, tier };
}

const COMPANY_FNS: Record<Fn, string[]> = {
  engineering: ["engineering"], ai: ["engineering", "research"], product: ["product"], design: ["design"],
  data: ["engineering"], operations: ["operations"], founder: [],
};

function companyOnly(company: SnapshotCompany, fn: Fn, place: string | null, ctx: Ctx): Reason[] | null {
  if (!company.functions.some((f) => COMPANY_FNS[fn].includes(f))) return null;
  if (fn === "ai" && !AI_WORDS.test(company.blurb.replace(new RegExp(escapeRegex(company.name), "gi"), " "))) return null;
  const reasons: Reason[] = [{ text: copy.reasons.fnCompany(copy.fnLabels[fn], company.name), cites: ["functions"] }];
  if (place) reasons.push({ text: copy.reasons.companyCity(shortLocation(company.location ?? "", place), place), cites: ["location"] });
  reasons.push(...personalReasons(ctx.profile, ctx.intake, null, company).reasons);
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

function better(a: Scored, b: Scored): boolean {
  if (a.tier !== b.tier) return a.tier > b.tier;
  if (a.score !== b.score) return a.score > b.score;
  const da = dayOf(a.role.postedAt), db = dayOf(b.role.postedAt);
  return da !== db ? da > db : a.role.id < b.role.id;
}

export function rankMatches(profile: Profile, intake: Intake, corpus: Corpus, limit = 6): MatchResult {
  const companies = corpus.companies.filter((c) => c.slug !== FUND_SLUG);
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const roles = corpus.roles.filter((r) => r.companySlug !== FUND_SLUG);

  const targets: Fn[] = intake.targets.length > 0 ? intake.targets : profile.functions;
  // What the visitor typed wins over what the resume implies.
  const places = (intake.places.length > 0 ? intake.places : profile.locations).filter(Boolean);
  const remoteOk = intake.places.length > 0 ? intake.places.some(isRemotePlace) : true;
  const ctx: Ctx = {
    profile,
    intake,
    newest: roles.reduce((max, r) => Math.max(max, dayOf(r.postedAt)), 0),
    hardwareSkills: HARDWARE_SKILL.test([...profile.skills, ...profile.shipped].join(" ")),
  };

  const best = new Map<string, Scored>();
  let afterFilters = 0;
  for (const role of roles) {
    const company = role.companySlug ? bySlug.get(role.companySlug) : undefined;
    if (!ALLOWED_LEVELS[profile.seniority].includes(levelOf(role))) continue;
    const fnIndex = targets.findIndex((fn) => roleHasFn(role, company, fn));
    if (fnIndex < 0) continue;
    const place = places.length > 0 ? placeFit(places, remoteOk, role) : null;
    if (places.length > 0 && !place) continue;
    afterFilters += 1;
    const scored = scoreRole(role, company, targets[fnIndex], fnIndex, place, ctx);
    const key = role.companySlug ?? role.company.toLowerCase();
    const prior = best.get(key);
    if (!prior || better(scored, prior)) best.set(key, scored);
  }

  const matches = [...best.values()]
    .sort((a, b) => (better(a, b) ? -1 : 1))
    .map(toMatch);

  // Companies with no role that passed the filters still show up, after every
  // role-backed match, when what they build lines up with what was asked for.
  const companyMatches: Match[] = [];
  for (const company of companies) {
    if (best.has(company.slug)) continue;
    const place = places.length > 0 ? places.find((p) => !isRemotePlace(p) && placeMatches(p, company.location)) ?? null : null;
    if (places.length > 0 && !place) continue;
    for (const fn of targets) {
      const reasons = companyOnly(company, fn, place, ctx);
      if (!reasons) continue;
      companyMatches.push({
        company: { name: company.name, slug: company.slug, logo: company.logo, cohort: company.cohort, stage: company.stage, blurb: company.blurb },
        role: null,
        score: Math.round((1 + reasons.length * 0.5) * 100) / 100,
        reasons,
        connect: ["intro", "follow"],
      });
      break;
    }
  }
  companyMatches.sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name));

  const shown = [...matches, ...companyMatches].slice(0, limit);
  // The same own-words line never repeats on more than two cards.
  const seen = new Map<string, number>();
  for (const match of shown) {
    match.reasons = match.reasons.filter((reason) => {
      if (!ownWords.has(reason)) return true;
      const n = (seen.get(reason.text) ?? 0) + 1;
      seen.set(reason.text, n);
      return n <= 2;
    });
  }
  return {
    matches: shown,
    routes: profile.founderSignal.score >= 0.6 ? ROUTES : [],
    narrowing: { companies: companies.length, roles: roles.length, afterFilters: afterFilters + companyMatches.length, shown: shown.length },
  };
}
