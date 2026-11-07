import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = ["app/speedrun", "components/speedrun", "lib/speedrun", "lib/content/speedrun.ts", "scripts/speedrun-snapshot.mjs"];
const ALLOWED_PACKAGES = ["react", "react-dom", "next", "zod", "ai", "unpdf", "botid", "vitest", "server-only", "lucide-react"];
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
const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["'`]([^"'`]+)["'`]/g;

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

// ---- Canonical boundary, transitive walk, fs and process-spawning ban (R51) ----
// There is no canary marker test: nothing private carries a fixed marker, so such a test could never fire. The walk and the fixtures below are the guard.

const BOUNDARY_DIRS = ["app/speedrun", "components/speedrun", "lib/speedrun"];
// Shared files outside the speedrun folders that the page may import, by canonical path without extension.
const BOUNDARY_FILES = ["lib/content/speedrun", "lib/content", "lib/fonts", "lib/theme", "lib/holding", "components/SiteLogo"];
const BOUNDARY_ASSET_DIRS = ["public/speedrun"];
const COPY_FILE = "lib/content/speedrun.ts";
const ENTRY_POINTS = ["app/speedrun/page.tsx", COPY_FILE, "app/speedrun/api/brief/route.ts", "app/speedrun/api/match/route.ts", "app/speedrun/api/read/route.ts"];
const FS_READER_ALLOWED = ["scripts/speedrun-snapshot.mjs"];
// File reads, process spawning and createRequire are all ways to reach private files at run time.
const FS_SPECIFIER = /^(?:node:)?(?:fs|child_process|module)(?:\/.*)?$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;
const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.tsx"];

// Resolve a local specifier to a canonical repo-relative path (no extension, posix, ".." collapsed), or null for packages.
function canonicalPath(specifier: string, fromFile: string): string | null {
  let joined: string;
  if (specifier.startsWith("@/")) joined = specifier.slice(2);
  else if (specifier.startsWith("./") || specifier.startsWith("../")) joined = path.posix.join(path.posix.dirname(fromFile), specifier);
  else return null;
  return path.posix.normalize(joined);
}

function stripExtension(canonical: string): string {
  return canonical.replace(/\.(tsx?|mjs|js|json)$/, "");
}

function insideBoundary(canonical: string): boolean {
  if (canonical.startsWith("../") || canonical === "..") return false;
  const base = stripExtension(canonical);
  if (BOUNDARY_DIRS.some((dir) => base === dir || base.startsWith(`${dir}/`))) return true;
  if (BOUNDARY_ASSET_DIRS.some((dir) => canonical.startsWith(`${dir}/`))) return true;
  return BOUNDARY_FILES.includes(base);
}

function resolveToFile(canonical: string, exists: (file: string) => boolean): string | null {
  for (const extension of EXTENSIONS) {
    if (exists(`${canonical}${extension}`) && /\.[a-z]+$/.test(`${canonical}${extension}`)) return `${canonical}${extension}`;
  }
  return null;
}

type VirtualFiles = Record<string, string>;

// Walk local imports from the entry points; return every violation as a readable line.
function auditGraph(entries: string[], read: (file: string) => string | null): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const queue = [...entries];
  const exists = (file: string) => read(file) !== null;
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = read(file);
    if (source === null) continue;
    if (!/\.json$/.test(file)) {
      for (const match of source.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1];
        if (FS_SPECIFIER.test(specifier) && !TEST_FILE.test(file) && !FS_READER_ALLOWED.includes(file)) {
          problems.push(`${file} imports ${specifier} (only ${FS_READER_ALLOWED.join(", ")} may read files or spawn processes)`);
        }
        const canonical = canonicalPath(specifier, file);
        if (canonical === null) continue;
        if (!insideBoundary(canonical)) {
          problems.push(`${file} imports ${specifier}, which resolves to ${canonical} outside the public boundary`);
          continue;
        }
        const target = resolveToFile(canonical, exists);
        // Shared files are checked as targets but not descended into: their own imports are outside this feature.
        if (target && (target === COPY_FILE || BOUNDARY_DIRS.some((dir) => target.startsWith(`${dir}/`)))) queue.push(target);
      }
    }
  }
  return problems;
}

describe("speedrun leak guard (graph, fs, process)", () => {
  const readReal = (file: string) => {
    const absolute = path.join(REPO_ROOT, file);
    return existsSync(absolute) && statSync(absolute).isFile() ? readFileSync(absolute, "utf8") : null;
  };

  it("every file reachable from the entry points stays inside the public boundary and reads no files", () => {
    expect(auditGraph(ENTRY_POINTS, readReal)).toEqual([]);
  });

  it("no speedrun runtime file imports fs, child_process or module, apart from the snapshot script", () => {
    const runtime = ROOTS.flatMap(listFiles).filter((file) => /\.(ts|tsx|mjs|js)$/.test(file) && !TEST_FILE.test(file));
    const offenders: string[] = [];
    for (const file of runtime) {
      const source = readFileSync(path.join(REPO_ROOT, file), "utf8");
      for (const match of source.matchAll(IMPORT_PATTERN)) {
        if (FS_SPECIFIER.test(match[1]) && !FS_READER_ALLOWED.includes(file)) offenders.push(`${file} imports ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  describe("fixtures prove the guard bites", () => {
    const entry = "app/speedrun/page.tsx";
    // Built at run time so this file's own import scan never sees a "from" followed by a quote.
    const imp = (specifier: string) => ["import", "x", "from", JSON.stringify(specifier)].join(" ") + ";\n";
    const reader = (virtual: VirtualFiles) => (file: string) => (file in virtual ? virtual[file] : null);

    it("rejects a traversal import that leaves the boundary", () => {
      const virtual = { [entry]: imp("@/lib/content/../hidden-area/x") };
      const problems = auditGraph([entry], reader(virtual));
      expect(problems.join("\n")).toContain("lib/hidden-area/x");
    });

    it("rejects a relative traversal out of a speedrun folder", () => {
      const virtual = { [entry]: imp("../../lib/hidden-area/data") };
      expect(auditGraph([entry], reader(virtual))).toHaveLength(1);
    });

    it("rejects an fs import in a runtime file, but allows the snapshot script", () => {
      const virtual = { [entry]: imp("node:fs"), "scripts/speedrun-snapshot.mjs": imp("node:fs") };
      expect(auditGraph([entry], reader(virtual))).toHaveLength(1);
      expect(auditGraph(["scripts/speedrun-snapshot.mjs"], reader(virtual))).toEqual([]);
    });

    it("checks a file reached through another file", () => {
      const virtual = {
        [entry]: imp("@/lib/speedrun/a"),
        "lib/speedrun/a.ts": imp("../hidden-area/b") + imp("fs"),
      };
      expect(auditGraph([entry], reader(virtual))).toHaveLength(2);
    });

    it("rejects child_process and module imports in runtime files", () => {
      for (const specifier of ["node:child_process", "child_process", "module", "node:module"]) {
        const virtual = { [entry]: imp(specifier) };
        expect(auditGraph([entry], reader(virtual)), specifier).toHaveLength(1);
      }
    });

    it("reads a backtick-quoted specifier", () => {
      const quoted = ["import", "x", "from", "`../../lib/hidden-area/data`"].join(" ") + ";\n";
      expect(auditGraph([entry], reader({ [entry]: quoted }))).toHaveLength(1);
      const dynamic = ["const m = await ", "import", "(`node:fs`);\n"].join("");
      expect(auditGraph([entry], reader({ [entry]: dynamic }))).toHaveLength(1);
    });

    it("walks the copy file and checks its imports canonically", () => {
      const virtual = { [entry]: imp("@/lib/content/speedrun"), [COPY_FILE]: imp("@/lib/content/../hidden-area/x") };
      expect(auditGraph([entry], reader(virtual)).join("\n")).toContain("lib/hidden-area/x");
      expect(auditGraph([COPY_FILE], reader(virtual))).toHaveLength(1);
    });
  });
});

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
