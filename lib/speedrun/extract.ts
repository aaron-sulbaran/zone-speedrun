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

const STRONG_FOUNDER = /\b(co-?founded|co-?founder|solo founder|founded|founder work|raised|y combinator|yc|accelerators?)\b/gi;
const WEAK_FOUNDER = /\b(founder|founding|started|side project|side company|my own compan(y|ies))\b/gi;

const SECTION_HEADS = new Set([
  "SUMMARY",
  "EDUCATION",
  "EXPERIENCE",
  "PROJECTS",
  "SKILLS",
  "ACTIVITIES",
  "LEADERSHIP",
  "FOUNDER WORK",
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function count(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function sections(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current = "TOP";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const head = line.replace(/\s*\(.*\)$/, "");
    if (SECTION_HEADS.has(head) || head === "SELECTED WORK") {
      current = head;
      continue;
    }
    if (!line) continue;
    map.set(current, [...(map.get(current) ?? []), line]);
  }
  return map;
}

function founderSignal(text: string): Profile["founderSignal"] {
  const strong = count(text, STRONG_FOUNDER);
  const weak = count(text, WEAK_FOUNDER);
  const score = Math.min(1, Math.min(0.6, strong * 0.2) + Math.min(0.3, weak * 0.08));
  const evidence = text
    .split("\n")
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter((line) => line && (new RegExp(STRONG_FOUNDER.source, "i").test(line) || /\bsolo founder\b/i.test(line)))
    .map((line) => line.split(/[.;]/)[0].trim())
    .slice(0, 3);
  return { score: Math.round(score * 100) / 100, evidence };
}

function pickSeniority(text: string): Profile["seniority"] {
  if (/\bsenior (software|engineer|designer|product|manager)/i.test(text) || /\bstaff\b/i.test(text)) return "senior";
  const lookingFor = text.split("\n").filter((line) => /^looking for/i.test(line)).join(" ");
  if (/intern(ship)?\b/i.test(lookingFor)) return "intern";
  if (/new grad|new graduate|early career/i.test(`${lookingFor} ${text}`)) return "new_grad";
  const years = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten) years?\b/i);
  if (years) {
    const raw = years[1].toLowerCase();
    const n = NUMBER_WORDS[raw] ?? Number(raw);
    if (n >= 5) return "senior";
    if (n >= 3) return "mid";
    return "junior";
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
  return /^[A-Za-z][A-Za-z'-]*$/.test(word) ? word : "";
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

function locationsFrom(text: string, intake: Intake): string[] {
  const contact = text.split("\n").find((line) => line.includes("@")) ?? "";
  const city = contact.split("|")[0]?.split(",")[0]?.trim() ?? "";
  const cities = [city, ...intake.places].filter((c) => c && c.length < 40);
  return [...new Set(cities)];
}

export function extractProfile(text: string, intake: Intake): Profile {
  const parts = sections(text);
  const founder = founderSignal(text);
  const skillsLine = parts.get("SKILLS")?.[0] ?? "";
  const skills = skillsLine
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const locations = locationsFrom(text, intake);
  return {
    firstName: firstName(text),
    headline: headlineFrom(parts),
    functions: pickFunctions(text, intake, founder.score),
    seniority: pickSeniority(text),
    skills,
    shipped: shippedFrom(parts),
    locations,
    remoteOk: intake.places.some((p) => /remote/i.test(p)) || /\bremote\b/i.test(text),
    founderSignal: founder,
    source: "rules",
  };
}
