import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The public mirror's verify step rejects any email-shaped string that does not match
// profiles.site.verify.allowedContentEmailPatterns. This test applies the same rule at
// commit time, so a new speedrun fixture cannot silently break the sync.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCAN_ROOTS = ["app/speedrun", "components/speedrun", "lib/speedrun", "lib/content/speedrun.ts", "e2e"];
const SCANNED_FILE = /\.(ts|tsx|mjs|js|json|css)$/;
// Same shape as scripts/public-repo/verify.mjs.
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

const EXPORT_CONFIG = path.join(REPO_ROOT, "scripts/public-repo/public-export.json");

function allowedPatterns(): RegExp[] {
  const config = JSON.parse(readFileSync(EXPORT_CONFIG, "utf8")) as {
    profiles: { site: { verify: { allowedContentEmailPatterns: string[] } } };
  };
  return config.profiles.site.verify.allowedContentEmailPatterns.map((pattern) => new RegExp(pattern, "i"));
}

function listFiles(target: string): string[] {
  const absolute = path.join(REPO_ROOT, target);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [target];
  return readdirSync(absolute).flatMap((entry) => listFiles(path.join(target, entry)));
}

function strayEmails(text: string, patterns: RegExp[]): string[] {
  return [...text.matchAll(EMAIL_PATTERN)].map((match) => match[0]).filter((email) => !patterns.some((pattern) => pattern.test(email)));
}

// The public export denies the config file but exports this test, so the mirror skips it instead of throwing ENOENT.
describe.skipIf(!existsSync(EXPORT_CONFIG))("speedrun public-mirror email allowlist", () => {
  const patterns = allowedPatterns();

  it("reads the allowlist from public-export.json", () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it("accepts reserved, hiring-platform and invented-host fixtures", () => {
    const accepted = ["x@halden.example", "x@sub.halden.example", "a@example.com", "no-reply@hire.lever.co", "priya@qorvanthe.co.uk"];
    for (const email of accepted) expect(strayEmails(email, patterns), email).toEqual([]);
  });

  it("flags an address on a real-looking domain", () => {
    const stray = ["priya", "acme.co.uk"].join("@");
    expect(strayEmails(`mail ${stray} now`, patterns)).toEqual([stray]);
  });

  it("finds no address in speedrun source, tests or e2e outside the allowlist", () => {
    const offenders: string[] = [];
    for (const file of SCAN_ROOTS.flatMap(listFiles).filter((entry) => SCANNED_FILE.test(entry))) {
      if (file.startsWith("e2e/") && !path.basename(file).startsWith("speedrun")) continue;
      for (const email of strayEmails(readFileSync(path.join(REPO_ROOT, file), "utf8"), patterns)) offenders.push(`${file}: ${email}`);
    }
    expect(offenders).toEqual([]);
  });
});
