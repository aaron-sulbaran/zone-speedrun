import { speedrunCopy } from "@/lib/content/speedrun";
import {
  AI_WORDS, aiStrength, cleanTitle, dayOf, escapeRegex, levelOf, namesArea, namesLevel, placeMatches, remoteFitsUs,
  shortLocation, titleFits, withArticle,
} from "./matchText";
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
  narrowing: { companies: number; roles: number; speedrunRoles: number; a16zRoles: number; afterFilters: number; shown: number };
};

type Corpus = Pick<Snapshot, "companies" | "roles">;
type Place = { kind: "city" | "remote"; place: string; location: string };

const FUND_SLUG = "speedrun";
const ROUTES: FounderRoute[] = [
  { kind: "speedrun", url: "https://speedrun.a16z.com/apply" },
  { kind: "alpha", url: "https://speedrun.a16z.com/alpha" },
];
const copy = speedrunCopy.matches;
const SPEEDRUN_BOOST = 5;
const TIER_BOOST = 12;
const LEVEL_BOOST = 1.5;
// A speedrun card moves up into the top three only from this close, and never past a better tier.
const PROMOTE_WINDOW = 2;
// Below this many role matches (but above none), company-only cards may fill on function alone.
const MIN_CARDS = 3;

const ALLOWED_LEVELS: Record<Profile["seniority"], number[]> = {
  intern: [0], new_grad: [1, 2], junior: [1, 2], mid: [1, 2, 3], senior: [2, 3, 4],
};

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


type Scored = { role: SnapshotRole; company: SnapshotCompany | undefined; score: number; reasons: Reason[]; tier: number; fits: boolean };
type Ctx = { profile: Profile; intake: Intake; newest: number; hardwareSkills: boolean };

const SOFTWARE_TITLE = /member of technical staff|\bmts\b|software|backend|back-end|frontend|front-end|full.?stack|mobile|\bios\b|android|platform|infrastructure|\bml\b|machine learning|\bai\b|\bweb\b|cloud|devops|\bsre\b|\bapi\b/i;
const WEAK_SOFTWARE_TITLE = /developer|\bdata\b|engineer/i;
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
  // Software titles lead for engineering and AI targets, unless the resume shows hardware skills. Hardware is
  // checked before the weak words, so "Mechanical Engineer" and "Systems Engineer I" take the penalty, and for
  // a software visitor such a title does not count as naming the function.
  const softwareTarget = (fn === "engineering" || fn === "ai") && !ctx.hardwareSkills;
  const software = softwareTarget && SOFTWARE_TITLE.test(role.title);
  const hardware = softwareTarget && !software && HARDWARE_TITLE.test(role.title);
  if (softwareTarget) score += software ? 4 : hardware ? -3 : WEAK_SOFTWARE_TITLE.test(role.title) ? 1 : 0;
  const fits = titleFits(role, fn) && !hardware;
  if (fits) score += 2;
  const ai = fn === "ai" ? aiStrength(role, company) : null;
  if (ai === "blurb") score -= 1.5;
  const reasons: Reason[] = [
    { text: namesArea(nameForTitle) ? copy.reasons.fnListed(label, nameForTitle) : copy.reasons.fnTitle(label, withArticle(nameForTitle)), cites: fits ? ["functions", "title"] : ["functions"] },
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
  // A title that names the visitor's own level ("New Grad", "Intern") edges out one that only allows it.
  if (namesLevel(role, profile.seniority)) score += LEVEL_BOOST;
  if (place) {
    score += place.kind === "city" ? 1.5 : 1;
    reasons.push({ text: place.kind === "city" ? copy.reasons.city(place.location, place.place) : copy.reasons.remote, cites: ["location"] });
  }
  // A warm intro to a speedrun founder is the network's whole promise, so speedrun roles lead when they fit.
  if (role.tier === "speedrun") score += SPEEDRUN_BOOST;
  const ageDays = (ctx.newest - dayOf(role.postedAt)) / (1000 * 60 * 60 * 24);
  score += ageDays <= 30 ? 0.5 : ageDays <= 120 ? 0.5 * (1 - (ageDays - 30) / 90) : -Math.min(3, (ageDays - 120) / 60);
  // The first target outranks every bonus.
  // Strong evidence only: the title names the function (for AI, the title or the description does).
  const tier = fnIndex === 0 && (fn === "ai" ? ai !== "blurb" : fits) ? 1 : 0;
  return { role, company, score, reasons, tier, fits };
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
      name: matchCompanyName(role, company),
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

const rank = (s: Scored) => s.score + TIER_BOOST * s.tier;

function better(a: Scored, b: Scored): boolean {
  if (rank(a) !== rank(b)) return rank(a) > rank(b);
  const da = dayOf(a.role.postedAt), db = dayOf(b.role.postedAt);
  return da !== db ? da > db : a.role.id < b.role.id;
}

/** The same own-words line never repeats on more than two cards, in rank order; a dropped line takes its points with it. */
function capOwnWords(cards: { score: number; reasons: Reason[] }[], seen: Map<string, number>): void {
  for (const card of cards) {
    card.reasons = card.reasons.filter((reason) => {
      const own = ownWords.get(reason);
      if (own === undefined) return true;
      const n = (seen.get(reason.text) ?? 0) + 1;
      seen.set(reason.text, n);
      if (n <= 2) return true;
      card.score -= own.points;
      return false;
    });
  }
}

/** The company a role belongs to, by its slug; the fund itself is no company. */
export function companyForRole<C extends Pick<SnapshotCompany, "slug">>(role: Pick<SnapshotRole, "companySlug">, companies: C[]): C | undefined {
  return role.companySlug && role.companySlug !== FUND_SLUG ? companies.find((entry) => entry.slug === role.companySlug) : undefined;
}

/** The company name a match shows for a role: its company's name, else the role's own. The brief keys its Bring forward by this. */
export function matchCompanyName(role: Pick<SnapshotRole, "company">, company: Pick<SnapshotCompany, "name"> | undefined): string {
  return company?.name ?? role.company;
}

/** What the visitor said about being a student wins over the level the profile implies. */
export function effectiveProfile(profile: Profile, intake: Intake): Profile {
  return intake.seniority ? { ...profile, seniority: intake.seniority } : profile;
}

export function rankMatches(ownProfile: Profile, intake: Intake, corpus: Corpus, limit = 6): MatchResult {
  const profile = effectiveProfile(ownProfile, intake);
  const companies = corpus.companies.filter((c) => c.slug !== FUND_SLUG);
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const roles = corpus.roles.filter((r) => r.companySlug !== FUND_SLUG);

  const targets: Fn[] = intake.targets.length > 0 ? intake.targets : profile.functions;
  // What the visitor typed wins over what the resume implies.
  const places = (intake.places.length > 0 ? intake.places : profile.locations).filter(Boolean);
  const remoteOk = intake.places.length > 0 ? intake.places.some(isRemotePlace) : profile.remoteOk;
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

  const byRank = (a: Scored, b: Scored) => (better(a, b) ? -1 : 1);
  const ranked = [...best.values()].sort(byRank);
  const seen = new Map<string, number>();
  capOwnWords(ranked, seen);
  ranked.sort(byRank);

  // Companies with no role that passed the filters still show up, after every
  // role-backed match, when what they build lines up with what was asked for.
  // When one or two roles survive, a company in no named city may still fill a card on function alone.
  // With none surviving the filters leave nothing, and the board says so rather than pad.
  const functionOnlySlots = ranked.length > 0 ? Math.max(0, MIN_CARDS - ranked.length) : 0;
  const functionOnly = new Set<Match>();
  const companyMatches: Match[] = [];
  for (const company of companies) {
    if (best.has(company.slug)) continue;
    const place = places.length > 0 ? places.find((p) => !isRemotePlace(p) && placeMatches(p, company.location)) ?? null : null;
    if (places.length > 0 && !place && functionOnlySlots === 0) continue;
    for (const fn of targets) {
      const reasons = companyOnly(company, fn, place, ctx);
      if (!reasons) continue;
      const match: Match = {
        company: { name: company.name, slug: company.slug, logo: company.logo, cohort: company.cohort, stage: company.stage, blurb: company.blurb },
        role: null,
        score: Math.round((1 + reasons.length * 0.5) * 100) / 100,
        reasons,
        connect: ["intro", "follow"],
      };
      companyMatches.push(match);
      if (places.length > 0 && !place) functionOnly.add(match);
      break;
    }
  }
  companyMatches.sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name));
  // Cards that fit a named city come first; function-only ones fill only the slots below three cards.
  let slotsLeft = functionOnlySlots;
  const keptCompanyMatches = companyMatches.filter((match) => !functionOnly.has(match) || slotsLeft-- > 0);
  capOwnWords(keptCompanyMatches, seen);

  // A warm intro to a speedrun founder is the network's whole promise, so a speedrun card that fits about
  // as well as the third card takes its place. It never jumps a card that fits the first target better,
  // or one whose title names what was asked for when its own title does not.
  const third = ranked[2];
  const fit = (s: Scored) => 2 * s.tier + Number(s.fits);
  const promoted = limit >= 3 && third
    ? ranked.slice(3).find((s) => s.role.tier === "speedrun" && fit(s) >= fit(third) && rank(third) - rank(s) <= PROMOTE_WINDOW)
    : undefined;
  const top = promoted && !ranked.slice(0, 3).some((s) => s.role.tier === "speedrun")
    ? [...ranked.slice(0, 2), promoted, ...ranked.slice(2).filter((s) => s !== promoted)]
    : ranked;
  const shown = [...top.slice(0, limit).map(toMatch), ...keptCompanyMatches].slice(0, limit);
  return {
    matches: shown,
    routes: intake.founding === true || profile.founderSignal.score >= 0.6 ? ROUTES : [],
    narrowing: {
      companies: companies.length,
      roles: roles.length,
      speedrunRoles: roles.filter((r) => r.tier === "speedrun").length,
      a16zRoles: roles.filter((r) => r.tier === "a16z").length,
      afterFilters: afterFilters + keptCompanyMatches.length,
      shown: shown.length,
    },
  };
}
