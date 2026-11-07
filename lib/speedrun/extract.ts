import { isUsStateName } from "./matchText";
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

// A student group the person founded is not a company. A team they grew inside one is fine.
// The group has to be what they founded: "founded a startup with a team" and "co-founded Acme with my team" are
// companies, while "founded the Startup Club" is a club.
const GROUPS = "club|chapter|society|association|fraternity|sorority|team|hackathon|organization|(?<!(accelerator|incubator)\\s)program";
const GROUP_NEAR = new RegExp(
  `\\b(founded|founder of|co-?founded|started)\\s+(the\\s+|a\\s+|our\\s+|my\\s+)?((?!(with|and|for|from|alongside)\\b)[\\w'-]+\\s+){0,3}(${GROUPS})\\b`,
  "i",
);
const GROUP_WORD = new RegExp(`\\b(${GROUPS})\\b`, "i");
const FOUNDER_STRONG = /\b(co-?founded|co-?founders?|solo founder|founded)\b/gi;
// A founder title line: "Founder & CEO, Acme", "Founder, Acme (YC S24)", "CEO and Founder, Acme", "Acme | Founder".
const FOUNDER_TITLE =
  /(^|[,|@\u2013-]\s*)founder(\s*(&|and|\/)\s*(ceo|cto|coo|president))?\s*([,|@(\u2013-]|\bat\b|$)|^(ceo|cto|coo|president)\s*(&|and|\/|,)\s*founder\b/i;
const FOUNDER_FUNDING =
  /\braised\b[^.]{0,40}(\$\s?\d[\d.,]*\s?(m|k|b|million|billion)\b|seed|pre-seed|round|funding|capital|investors?|angels?|series [a-c]|million)/gi;
const NOT_FUNDING = /food bank|food drive|blood drive|toy drive|charity|donat|fundrais|nonprofit|scholarship|sponsor/i;
const FOUNDER_PROGRAM = /\b(accelerators?|incubators?|y combinator|yc)\b/gi;
// Only the word "accelerator" is voided, and only as a chip: founding, raising and YC always count.
const HARDWARE_ACCEL =
  /\b(fpga|gpu|tpu|npu|cnn|asic|hardware|particle|linear|ml|machine learning|neural(\s+network)?|deep learning|inference|ai)\s+accelerators?\b(?!\s+(program|cohort|batch|startup))/gi;
const FOUNDER_WEAK = /\b(founder|founding|started|side project|side company|my own compan(y|ies))\b/gi;

/** Closing lines like "Looking for...", "I'm looking for..." or "Open to relocation". */
const LOOKING = /^(i'?m\s+|i am\s+)?(looking for|seeking|objective|open to)\b/i;

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
    if (current !== "TOP" && LOOKING.test(line)) current = "CLOSING";
    map.set(current, [...(map.get(current) ?? []), line]);
  }
  return map;
}

/** Up to the first full stop or semicolon, so "$1.5M" and "Next.js" stay whole. */
const firstSentence = (line: string): string => (line.split(/(?<=[a-z0-9)])[.;](\s|$)/i)[0] ?? "").trim();

function founderSignal(text: string): Profile["founderSignal"] {
  let foundingHits = 0;
  let otherHits = 0;
  let weak = 0;
  const evidence: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[-\s]+/, "").trim();
    if (!line || headingOf(line)) continue;
    // A club or chapter is not a company; funding needs funding words.
    const groupLine = GROUP_NEAR.test(line);
    const funding = NOT_FUNDING.test(line) ? 0 : count(line, FOUNDER_FUNDING);
    const program = count(line.replace(HARDWARE_ACCEL, " "), FOUNDER_PROGRAM);
    const titled = FOUNDER_TITLE.test(line) && !GROUP_WORD.test(line) ? 1 : 0;
    const founding = groupLine ? 0 : count(line, FOUNDER_STRONG) || titled;
    const lineStrong = founding + funding + program;
    foundingHits += founding;
    otherHits += funding + program;
    if (!groupLine) weak += count(line, FOUNDER_WEAK);
    if (lineStrong > 0 && evidence.length < 3) evidence.push(firstSentence(line));
  }
  const strong = Math.min(0.9, Math.min(0.7, foundingHits * 0.35) + Math.min(0.6, otherHits * 0.25));
  const score = Math.min(1, strong + Math.min(0.3, weak * 0.08));
  return { score: Math.round(score * 100) / 100, evidence };
}

const TITLE_LINE =
  /^(senior|sr\.?|staff|principal|lead)\s+(software|engineer|developer|designer|product|data|machine|ml|ai|research|manager|analyst|scientist|architect|frontend|backend|full)/i;

// Someone who mentors, hires or leads them, not someone who wants mentorship or to be mentored.
const MANAGING =
  /(?<!\b(be|get|getting|being)\s)\b(mentor(?!ship)|manag|supervis|hir(e|ing)|train(?!ing\b)|lead|led|coach|oversaw|onboard|teach|advis)\w*\W+(\w+\W+){0,3}$/i;
const PAST_BEFORE = /\b(was|were|been|previous(ly)?|past|prior|former|completed|finished|did)\b[^,;.]*$/i;
// "After" marks the past only before a plural or a count: "after two internships", not "after junior year".
const AFTER_BEFORE = /\bafter\b[^,;.]*$/i;
const COUNT_BEFORE = /\b(two|three|four|five|six|several|multiple|many|few|couple|\d+)\s+(\w+\s+)?$/i;
const PAST_AFTER = /^[^,;.]*\b(behind me|last (summer|year|fall|spring|winter)|ago)\b/i;
const INTERN_THING = /^\s*(program|onboarding|class|cohort|team|mentor|coordinator|events?|hiring|manager)\b/i;
// New grads someone works with: "mentor new grads", "hires early career engineers".
const NEW_GRAD = /\b(new grad(uate)?s?|early career)\b/gi;
const PEOPLE_AFTER = /^\s*(engineers|developers|designers|hires|talent|candidates|folks|people|employees)\b/i;

/** A new grad role they want, not new grads they mentor or hire. */
function seeksNewGrad(text: string): boolean {
  for (const m of text.matchAll(NEW_GRAD)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 40), at);
    const after = text.slice(at + m[0].length, at + m[0].length + 30);
    if (/s$/i.test(m[0]) || MANAGING.test(before) || PEOPLE_AFTER.test(after)) continue;
    return true;
  }
  return false;
}

/**
 * An intern role they want ("intern role", "internship", "open to internships"), not interns they work
 * with ("taught interns", "ran the intern program") or internships behind them ("after two internships").
 */
function seeksIntern(text: string): boolean {
  for (const m of text.matchAll(/\b(interns?|internships?)\b/gi)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 40), at);
    const after = text.slice(at + m[0].length, at + m[0].length + 40);
    const word = m[0].toLowerCase();
    if (word === "interns") continue;
    if (MANAGING.test(before) || PAST_BEFORE.test(before) || PAST_AFTER.test(after)) continue;
    if (AFTER_BEFORE.test(before) && (word === "internships" || COUNT_BEFORE.test(before))) continue;
    // "Ran the intern program" is about the program; "an internship program" is still an internship.
    if (word === "intern" && (/\bthe\s+$/i.test(before) || INTERN_THING.test(after))) continue;
    return true;
  }
  return false;
}

function pickSeniority(text: string, parts: Map<string, string[]>, intake: Intake): Profile["seniority"] {
  const lookingFor = `${text.split("\n").filter((line) => LOOKING.test(line.trim())).join(" ")} ${intake.why}`;
  // New grad wording first: "a new grad role after two internships" is a new grad.
  if (seeksNewGrad(lookingFor)) return "new_grad";
  if (seeksIntern(lookingFor)) return "intern";
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

const DESCRIPTION_MAX = 140;

/** The first sentence of a bullet, or its first 140 characters cut at a word edge, whichever is shorter. */
function whatItDoes(bullet: string): string {
  const sentence = firstSentence(bullet);
  if (sentence.length <= DESCRIPTION_MAX) return sentence;
  return sentence.slice(0, DESCRIPTION_MAX + 1).replace(/\s+\S*$/, "").replace(/[,;:]$/, "");
}

/** Project names with the first clause of their bullet, so matching can use what the thing does. */
function shippedFrom(parts: Map<string, string[]>): string[] {
  const lines = [...(parts.get("PROJECTS") ?? []), ...(parts.get("FOUNDER WORK") ?? []), ...(parts.get("SELECTED WORK") ?? [])];
  const items: string[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("-")) return;
    const name = line.replace(/^Founder side project:\s*/i, "").split(/[,:]/)[0].trim();
    if (!name || name.length > 40 || /^(open source|wrote|spoke)/i.test(name)) return;
    const bullet = lines[i + 1]?.startsWith("-") ? lines[i + 1].replace(/^-\s*/, "") : "";
    const description = whatItDoes(bullet);
    items.push(description ? `${name} (${description})` : name);
  });
  return items.slice(0, 4);
}

const US_CODE = /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/;
const COUNTRY = /^(united states|usa|us|canada|mexico|m\u00e9xico|uk|united kingdom|england|ireland|india|germany|france|spain|espa\u00f1a|brazil|australia|singapore|japan|china|korea|netherlands|portugal|italy)$/i;
const KNOWN_CITY = /^(san francisco bay area|bay area|san francisco|new york|nyc|brooklyn|manhattan|austin|seattle|boston|chicago|los angeles|denver|atlanta|miami|dallas|houston|portland|philadelphia|toronto|london|berlin|remote)$/i;
const BOROUGH: Record<string, string> = {
  brooklyn: "New York", manhattan: "New York", queens: "New York", nyc: "New York",
  "san francisco bay area": "San Francisco", "bay area": "San Francisco",
};

/** The city is the first contact segment shaped like a place: "City, ST", "City, Country" or a known city. */
function cityFrom(segment: string): string {
  const parts = segment.split(",").map((p) => p.trim());
  const city = parts[0] ?? "";
  if (!city || city.length > 30 || /@|https?:|www\.|\d/.test(segment)) return "";
  const placeShaped = parts.length >= 2 && (US_CODE.test(parts[1]) || isUsStateName(parts[1]) || COUNTRY.test(parts[1]));
  if (!placeShaped && !(parts.length === 1 && KNOWN_CITY.test(city))) return "";
  return BOROUGH[city.toLowerCase()] ?? city;
}

function locationsFrom(text: string, intake: Intake): string[] {
  const head = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(1, 5);
  const segments = head.flatMap((line) => (/[|\u2022\u00b7@]/.test(line) ? line.split(/[|\u2022\u00b7]/) : []));
  const city = segments.map((seg) => cityFrom(seg.trim())).find(Boolean) ?? "";
  return [...new Set([city, ...intake.places].filter((c) => c && c.length < 40))];
}

export function extractProfile(rawText: string, intake: Intake): Profile {
  const text = rawText.normalize("NFC").replace(/\r\n?/g, "\n");
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
