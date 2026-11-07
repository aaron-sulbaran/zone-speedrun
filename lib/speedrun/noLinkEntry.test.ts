import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// BotIdClient on /speedrun is an inline script, so it only runs on a full page
// load. A next/link (or router push) into /speedrun would skip it and leave the
// read and brief posts unprotected.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = ["app", "components"];
const CODE = /\.(ts|tsx)$/;
const INTO_SPEEDRUN = /(href\s*=\s*[{"'`]+\s*["'`]?\/speedrun(?![\w/-]*\/api)|(?:push|replace|prefetch)\(\s*["'`]\/speedrun)/;

function files(dir: string): string[] {
  return readdirSync(path.join(REPO_ROOT, dir)).flatMap((entry) => {
    const next = path.join(dir, entry);
    return statSync(path.join(REPO_ROOT, next)).isDirectory() ? files(next) : CODE.test(entry) ? [next] : [];
  });
}

describe("entry into /speedrun", () => {
  it("is never a client-side navigation", () => {
    const hits = ROOTS.flatMap(files).filter((file) => INTO_SPEEDRUN.test(readFileSync(path.join(REPO_ROOT, file), "utf8")));
    expect(hits).toEqual([]);
  });

  it("the pattern catches the links it is meant to catch", () => {
    for (const bad of ['<Link href="/speedrun">', "<Link href={'/speedrun'}>", 'router.push("/speedrun")', '<a href="/speedrun#join">']) {
      expect(INTO_SPEEDRUN.test(bad)).toBe(true);
    }
    expect(INTO_SPEEDRUN.test('fetch("/speedrun/api/read")')).toBe(false);
  });
});
