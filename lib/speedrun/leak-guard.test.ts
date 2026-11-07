import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app/speedrun", "components/speedrun", "lib/speedrun", "scripts/speedrun-snapshot.mjs"];
const ALLOWED_PREFIXES = [
  "react",
  "react-dom",
  "next",
  "zod",
  "ai",
  "@ai-sdk/",
  "unpdf",
  "vitest",
  "node:",
  "./",
  "../",
  "@/lib/speedrun",
  "@/components/speedrun",
  "@/lib/content",
  "@/lib/fonts",
  "@/lib/theme",
  "@/lib/holding",
  "@/components/SiteLogo",
];
const CODE_FILE = /\.(ts|tsx|mjs|js|json|css)$/;
const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["']([^"']+)["']/g;

function listFiles(target: string): string[] {
  const absolute = path.join(process.cwd(), target);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [target];
  return readdirSync(absolute).flatMap((entry) => listFiles(path.join(target, entry)));
}

function isAllowed(specifier: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

describe("speedrun leak guard", () => {
  const files = ROOTS.flatMap(listFiles).filter((file) => CODE_FILE.test(file));

  it("imports only from the allowed modules", () => {
    for (const file of files.filter((entry) => !entry.endsWith(".json"))) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const match of source.matchAll(IMPORT_PATTERN)) {
        expect(isAllowed(match[1]), `${file} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it("contains no em dash", () => {
    const emDash = String.fromCharCode(0x2014);
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source.includes(emDash), `${file} has an em dash`).toBe(false);
    }
  });
});
