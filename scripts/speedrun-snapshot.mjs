// Builds lib/speedrun/snapshot.json from the talent network's public API.
// Run by hand only: node scripts/speedrun-snapshot.mjs
// One request per 1.2 s. Any challenge or rate limit stops the run and keeps nothing.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://speedrun-talent-network.com";
const API = `${BASE}/api/v1`;
const UA = "Mozilla/5.0 portfolio-research";
const GAP_MS = 1200;
const MAX_LOGO_BYTES = 200 * 1024;
const MAX_A16Z = 400;
const EXCERPT_CHARS = 600;
const BLOCKED_MARK = "-ad00000";

let lastRequestAt = 0;
let lastUrl = "";

function fail(message) {
  console.error(`BLOCKED: ${message} (last url: ${lastUrl})`);
  process.exit(1);
}

async function politeFetch(url, hops = 0) {
  if (url.includes(BLOCKED_MARK)) fail("refusing a blocked url");
  const wait = lastRequestAt + GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  lastUrl = url;
  const response = await fetch(url, { headers: { "user-agent": UA }, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || hops >= 3) fail("too many redirects");
    return politeFetch(new URL(location, url).href, hops + 1);
  }
  if (response.status === 403 || response.status === 429) fail(`HTTP ${response.status}`);
  if (!response.ok) fail(`HTTP ${response.status}`);
  return response;
}

async function getJson(url) {
  const response = await politeFetch(url);
  const text = await response.text();
  if (text.includes("error code: 1015")) fail("rate limited (1015)");
  try {
    return JSON.parse(text);
  } catch {
    return fail("non-JSON body");
  }
}

async function getAllJobs(query) {
  const jobs = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const data = await getJson(`${API}/jobs?${query}&page=${page}&source=portfolio-research`);
    jobs.push(...data.jobs);
    totalPages = data.total_pages;
    page += 1;
  }
  return jobs;
}

// The repo bans em dashes, and the fetched text is rewritten to say hiring where it says the r-word.
const EM_DASH = String.fromCharCode(0x2014);
const MIRROR_WORD = new RegExp(`${"recr"}${"uit"}(?!ers?\\b)\\w*`, "gi");

function scrub(text) {
  return text
    .split(EM_DASH)
    .join(" - ")
    .replace(/ {2,}- {2,}/g, " - ")
    .replace(MIRROR_WORD, (word) => (word[0] === "R" ? "Hiring" : "hiring"));
}

function collapse(text) {
  return scrub(String(text ?? "").replace(/\s+/g, " ").trim());
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const collection = await getJson(`${API}/collections/speedrun-companies?source=portfolio-research`);
const members = collection.collection.members;

const speedrunJobs = await getAllJobs("portfolio=speedrun&sort=new");
const foundingJobs = await getAllJobs("founding=1&sort=new");

const a16zJobs = [];
{
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 10) {
    const data = await getJson(
      `${API}/jobs?portfolio=a16z&lvl=intern,new_grad,junior&sort=new&page=${page}&source=portfolio-research`,
    );
    a16zJobs.push(...data.jobs);
    totalPages = data.total_pages;
    page += 1;
  }
}

const byId = new Map();
for (const job of [...speedrunJobs, ...foundingJobs, ...a16zJobs.slice(0, MAX_A16Z)]) {
  if (job.url?.includes(BLOCKED_MARK)) continue;
  if (!byId.has(job.id)) byId.set(job.id, job);
}
const jobList = [...byId.values()];

const excerpts = new Map();
for (const job of jobList.filter((entry) => entry.tier === "speedrun")) {
  const detail = await getJson(`${API}/jobs/${job.id}?source=portfolio-research`);
  excerpts.set(job.id, collapse(detail.job?.description_text).slice(0, EXCERPT_CHARS));
}

const joinResponse = await politeFetch(`${BASE}/join/`);
const joinHtml = await joinResponse.text();
const portfolio = [];
const seenNames = new Set();
const pillPattern =
  /jb-pill-name[^>]*>([^<]+)<\/span>\s*<span[^>]*jb-pill-tag[^>]*>([^<]*)<\/span>/g;
for (const match of joinHtml.matchAll(pillPattern)) {
  const name = decodeEntities(match[1]).trim();
  if (!name || seenNames.has(name)) continue;
  seenNames.add(name);
  portfolio.push({ name, sector: decodeEntities(match[2]).trim() });
}
if (portfolio.length < 100) fail(`portfolio wall parsed only ${portfolio.length} names`);

const logoFiles = new Map();
const companies = [];
for (const member of members) {
  let logo = null;
  if (member.logo) {
    const response = await politeFetch(member.logo);
    const type = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    const urlExt = path.extname(new URL(member.logo).pathname).slice(1).toLowerCase();
    const ext = type.includes("svg") ? "svg" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("jpeg") ? "jpg" : urlExt || "png";
    if (bytes.length <= MAX_LOGO_BYTES && type.startsWith("image/")) {
      logo = `/speedrun/companies/${member.slug}.${ext}`;
      logoFiles.set(logo, bytes);
    }
  }
  companies.push({
    slug: member.slug,
    name: member.name,
    cohort: member.cohort ?? null,
    stage: member.stage ?? null,
    blurb: collapse(member.blurb),
    location: member.location ?? null,
    remotePolicy: member.remote_policy ?? null,
    functions: member.functions ?? [],
    openRoles: member.open_roles ?? 0,
    logo,
    url: member.url,
  });
}

const markResponse = await politeFetch(`${BASE}/skill/logos/base/svg/Horizontal_mono_color_on_light.svg`);
const markText = await markResponse.text();
if (!markText.includes("<svg")) fail("official logo was not an svg");

const roles = jobList.map((job) => ({
  id: job.id,
  company: job.company,
  companySlug: job.company_slug ?? null,
  title: job.title,
  location: job.location ?? null,
  workplace: job.workplace_type ?? null,
  fn: job.function ?? null,
  seniority: job.seniority ?? null,
  tier: job.tier,
  cohort: job.cohort ?? null,
  compMin: job.comp_min ?? null,
  compMax: job.comp_max ?? null,
  compPeriod: job.comp_period ?? null,
  postedAt: job.published_at,
  url: job.url,
  excerpt: excerpts.get(job.id) ?? "",
}));

await mkdir(path.join(ROOT, "public/companies"), { recursive: true });
await mkdir(path.join(ROOT, "lib/speedrun"), { recursive: true });
for (const [localPath, bytes] of logoFiles) {
  // localPath carries the basePath (/speedrun/companies/x.png); the file sits at public/companies/x.png.
  await writeFile(path.join(ROOT, "public", localPath.replace(/^\/speedrun/, "")), bytes);
}
await writeFile(path.join(ROOT, "public/speedrun-logo.svg"), markText);
const snapshot = { fetchedAt: new Date().toISOString(), companies, roles, portfolio };
const snapshotText = scrub(JSON.stringify(snapshot));
await writeFile(path.join(ROOT, "lib/speedrun/snapshot.json"), `${snapshotText}\n`);

const countTier = (tier) => roles.filter((role) => role.tier === tier).length;
console.log(
  `companies=${companies.length} roles=${roles.length} speedrun=${countTier("speedrun")} a16z=${countTier("a16z")} market=${countTier("market")} founding_fetched=${foundingJobs.length} portfolio=${portfolio.length} logos=${logoFiles.size}`,
);
