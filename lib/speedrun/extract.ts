import type { Fn, Intake, Profile } from "./types";

// A rules-only resume reader. It is the floor that always works: no keys, no
// network, same answer every time.

const FN_PATTERNS: Record<Exclude<Fn, "founder">, RegExp> = {
  engineering:
    /\b(software|engineer(ing)?|developer|backend|frontend|full.?stack|api|react|python|java|typescript|firmware|kubernetes|c\+\+|code)\b/gi,
  ai: /\b(machine learning|ml|nlp|language models?|llms?|pytorch|hugging face|retrieval|fine-tuned|neural|embeddings?|prompts?|inference|rag)\b/gi,
  product:
    /\b(product|customer interviews?|customer calls?|backlog|roadmap|users|pilots|onboarding|launched)\b/gi,
  design:
    /\b(design(er|ed|s)?|figma|prototyp\w*|usability|ux|user research|accessibility|wireframes?)\b/gi,
  data: /\b(data (science|analy\w+)|analytics|dashboards?|etl|warehouse)\b/gi,
  operations: /\b(operations|logistics|supply chain|program management|process improvement)\b/gi,
};

// Product words are rarer than engineering words in a resume, so they weigh more.
const FN_WEIGHT: Record<keyof typeof FN_PATTERNS, number> = {
  engineering: 1,
  ai: 1.6,
  product: 1.6,
  design: 1.4,
  data: 1.2,
  operations: 1.2,
};

// Section headings, any case, with common variants (and a few Spanish ones).
const HEADINGS: Record<string, string> = {
  summary: "SUMMARY", profile: "SUMMARY", objective: "SUMMARY", about: "SUMMARY", resumen: "SUMMARY",
  education: "EDUCATION", educacion: "EDUCATION", "educaci\u00f3n": "EDUCATION",
  experience: "EXPERIENCE", "work experience": "EXPERIENCE", "professional experience": "EXPERIENCE",
  employment: "EXPERIENCE", "work history": "EXPERIENCE", experiencia: "EXPERIENCE",
  projects: "PROJECTS", "personal projects": "PROJECTS", proyectos: "PROJECTS",
  "selected work": "SELECTED WORK",
  skills: "SKILLS", "technical skills": "SKILLS", "core skills": "SKILLS", habilidades: "SKILLS",
  activities: "ACTIVITIES", leadership: "LEADERSHIP", "founder work": "FOUNDER WORK",
};

function headingOf(line: string): string | null {
  const key = line.trim().replace(/\s*\(.*\)$/, "").replace(/:$/, "").toLowerCase();
  return key.length < 30 ? HEADINGS[key] ?? null : null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const GROUP = /\b(club|chapter|society|association|fraternity|sorority|team)\b/i;
const FOUNDER_STRONG = /\b(co-?founded|co-?founders?|solo founder|founded)\b/gi;
const FOUNDER_FUNDING = /\braised\b[^.]{0,40}(\$|seed|pre-seed|round|funding|capital|investors?|angels?|series [a-c]|million)/gi;
const FOUNDER_PROGRAM = /(?<!particle )(?<!linear )\b(accelerators?|incubators?|y combinator|yc)\b/gi;
const FOUNDER_WEAK = /\b(founder|founding|started|side project|side company|my own compan(y|ies))\b/gi;

function count(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function sections(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current = "TOP";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const head = headingOf(line);
    if (head) {
      current = head;
      continue;
    }
    if (!line) continue;
    map.set(current, [...(map.get(current) ?? []), line]);
  }
  return map;
}

function founderSignal(text: string): Profile["founderSignal"] {
  let strong = 0;
  let weak = 0;
  const evidence: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[-\s]+/, "").trim();
    if (!line || headingOf(line)) continue;
    // A club or chapter is not a company; funding needs funding words.
    const groupLine = GROUP.test(line);
    const lineStrong = (groupLine ? 0 : count(line, FOUNDER_STRONG)) + count(line, FOUNDER_FUNDING) + count(line, FOUNDER_PROGRAM);
    strong += lineStrong;
    if (!groupLine) weak += count(line, FOUNDER_WEAK);
    if (lineStrong > 0 && evidence.length < 3) evidence.push(line.split(/[.;]/)[0].trim());
  }
  const score = Math.min(1, Math.min(0.6, strong * 0.2) + Math.min(0.3, weak * 0.08));
  return { score: Math.round(score * 100) / 100, evidence };
}

const TITLE_LINE =
  /^(senior|sr\.?|staff|principal|lead)\s+(software|engineer|developer|designer|product|data|machine|ml|ai|research|manager|analyst|scientist|architect|frontend|backend|full)/i;

function pickSeniority(text: string, parts: Map<string, string[]>, intake: Intake): Profile["seniority"] {
  const lookingFor = `${text.split("\n").filter((line) => /^(looking for|seeking|objective)/i.test(line.trim())).join(" ")} ${intake.why}`;
  if (/intern(ship)?\b/i.test(lookingFor)) return "intern";
  if (/new grad|new graduate|early career/i.test(lookingFor)) return "new_grad";
  // Seniority needs job-title context: a title line in the experience section with dates.
  const titles = (parts.get("EXPERIENCE") ?? []).filter((l) => !l.startsWith("-") && /\b(19|20)\d\d\b|present/i.test(l));
  if (titles.some((l) => TITLE_LINE.test(l))) return "senior";
  if (/\bnew grad(uate)?\b/i.test(text)) return "new_grad";
  const years = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\+? years?\b/i);
  if (years) {
    const raw = years[1].toLowerCase();
    const n = NUMBER_WORDS[raw] ?? Number(raw);
    if (n >= 5) return "senior";
    if (n >= 3) return "mid";
  }
  return "junior";
}

function pickFunctions(text: string, intake: Intake, founder: number): Fn[] {
  const scored = (Object.keys(FN_PATTERNS) as (keyof typeof FN_PATTERNS)[]).map((fn) => {
    const hits = count(text, FN_PATTERNS[fn]) * FN_WEIGHT[fn];
    // The visitor's own answer breaks ties: the first target gets the biggest nudge.
    const index = intake.targets.indexOf(fn);
    const nudge = index === 0 ? 4 : index > 0 ? 2 : 0;
    return { fn: fn as Fn, score: hits + nudge };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  const picked = scored.filter((s) => s.score >= 3 && s.score >= top * 0.45).slice(0, 3).map((s) => s.fn);
  const result: Fn[] = picked.length > 0 ? picked : intake.targets.filter((t) => t !== "founder").slice(0, 2);
  if (founder >= 0.6) {
    const lead: Fn = "founder";
    return [lead, ...result.filter((fn) => fn !== lead)].slice(0, 3);
  }
  if (result.length === 0 && intake.targets.length > 0) return [intake.targets[0]];
  return result.length > 0 ? result : (["engineering"] as Fn[]);
}

function firstName(text: string): string {
  const first = text.split("\n").find((line) => line.trim())?.trim() ?? "";
  const word = first.split(/\s+/)[0] ?? "";
  return /^\p{L}[\p{L}'-]*$/u.test(word) ? word : "";
}

function headlineFrom(parts: Map<string, string[]>): string {
  const summary = parts.get("SUMMARY")?.[0];
  if (summary) return summary.split(/[.;]/)[0].trim();
  const title = parts.get("EXPERIENCE")?.find((line) => !line.startsWith("-"));
  return title ? title.split(",")[0].trim() : "";
}

function shippedFrom(parts: Map<string, string[]>): string[] {
  const lines = [...(parts.get("PROJECTS") ?? []), ...(parts.get("FOUNDER WORK") ?? []), ...(parts.get("SELECTED WORK") ?? [])];
  const names: string[] = [];
  for (const line of lines) {
    if (line.startsWith("-")) continue;
    const name = line.replace(/^Founder side project:\s*/i, "").split(/[,:]/)[0].trim();
    if (name && name.length <= 40 && !/^(open source|wrote|spoke)/i.test(name)) names.push(name);
  }
  return names.slice(0, 4);
}

const NOT_A_CITY = /@|https?:|www\.|\.(com|dev|design|io|net|org)\b|github|linkedin|\d{3}[-. )]*\d{3,4}|^\+?\d/i;

/** The city is the first contact segment that is not an email, phone number or link. */
function locationsFrom(text: string, intake: Intake): string[] {
  const head = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(1, 5);
  const contact = head.find((line) => /[|\u2022\u00b7@]/.test(line)) ?? "";
  const segment = contact.split(/[|\u2022\u00b7]/).map((p) => p.trim()).find((p) => p && !NOT_A_CITY.test(p)) ?? "";
  const city = segment.split(",")[0]?.trim() ?? "";
  return [...new Set([city, ...intake.places].filter((c) => c && c.length < 40))];
}

export function extractProfile(rawText: string, intake: Intake): Profile {
  const text = rawText.replace(/\r\n?/g, "\n");
  const parts = sections(text);
  const founder = founderSignal(text);
  const skills = (parts.get("SKILLS") ?? [])
    .join(",")
    .split(/[,;\u2022|]/)
    .map((s) => s.trim().replace(/^[-\s]+/, ""))
    .filter(Boolean)
    .slice(0, 12);
  return {
    firstName: firstName(text),
    headline: headlineFrom(parts),
    functions: pickFunctions(text, intake, founder.score),
    seniority: pickSeniority(text, parts, intake),
    skills,
    shipped: shippedFrom(parts),
    locations: locationsFrom(text, intake),
    remoteOk: intake.places.some((p) => /remote/i.test(p)) || /\bremote\b/i.test(text),
    founderSignal: founder,
    source: "rules",
  };
}
