import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = ["app/speedrun", "components/speedrun", "lib/speedrun", "scripts/speedrun-snapshot.mjs"];
const ALLOWED_PACKAGES = ["react", "react-dom", "next", "zod", "ai", "unpdf", "vitest", "server-only"];
const ALLOWED_SCOPES = ["@ai-sdk/"];
const ALLOWED_NODE = "node:";
const ALLOWED_ALIASES = [
  "@/lib/speedrun",
  "@/components/speedrun",
  "@/lib/content",
  "@/lib/fonts",
  "@/lib/theme",
  "@/lib/holding",
  "@/components/SiteLogo",
];
const ALLOWED_RELATIVE_DIRS = ["app/speedrun", "components/speedrun", "lib/speedrun", "lib/content", "public/speedrun"];
const CODE_FILE = /\.(ts|tsx|mjs|js|json|css)$/;
const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["']([^"']+)["']/g;

function listFiles(target: string): string[] {
  const absolute = path.join(REPO_ROOT, target);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [target];
  return readdirSync(absolute).flatMap((entry) => listFiles(path.join(target, entry)));
}

function isInside(directory: string, target: string): boolean {
  const relative = path.relative(path.join(REPO_ROOT, directory), target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isAllowed(specifier: string, file: string): boolean {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const resolved = path.resolve(path.dirname(path.join(REPO_ROOT, file)), specifier);
    return ALLOWED_RELATIVE_DIRS.some((directory) => isInside(directory, resolved));
  }
  if (specifier.startsWith(ALLOWED_NODE)) return true;
  if (ALLOWED_SCOPES.some((scope) => specifier.startsWith(scope))) return true;
  if (ALLOWED_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`))) return true;
  return ALLOWED_ALIASES.some((alias) => specifier === alias || specifier.startsWith(`${alias}/`));
}

describe("speedrun leak guard", () => {
  const files = ROOTS.flatMap(listFiles).filter((file) => CODE_FILE.test(file));

  it("finds files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("imports only from the allowed modules", () => {
    for (const file of files.filter((entry) => !entry.endsWith(".json"))) {
      const source = readFileSync(path.join(REPO_ROOT, file), "utf8");
      for (const match of source.matchAll(IMPORT_PATTERN)) {
        expect(isAllowed(match[1], file), `${file} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it("contains no em dash", () => {
    const emDash = String.fromCharCode(0x2014);
    for (const file of files) {
      const source = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(source.includes(emDash), `${file} has an em dash`).toBe(false);
    }
  });
});
