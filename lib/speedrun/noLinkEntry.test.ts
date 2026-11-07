import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// BotIdClient on /speedrun is an inline script, so it only runs on a full page
// load. A next/link (or router push) into /speedrun would skip it and leave the
// read and brief posts unprotected.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = ["app", "components", "lib/content"];
const CODE = /\.(ts|tsx)$/;
// Only client-side navigation is a problem: a next/link, an `href:` object key (which feeds one) or a router call.
// A plain <a href="/speedrun"> is a full page load and is fine.
const INTO_SPEEDRUN =
  /(<Link\b[^>]*?\bhref\s*=\s*[{"'`]+\s*["'`]?\/speedrun(?![\w/-]*\/api)|\bhref\s*:\s*["'`]\/speedrun(?![\w/-]*\/api)|(?:push|replace|prefetch)\(\s*["'`]\/speedrun)/;

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
    for (const bad of [
      '<Link href="/speedrun">',
      "<Link href={'/speedrun'}>",
      '<Link\n  className="x"\n  href="/speedrun#join"\n>',
      'router.push("/speedrun")',
      '{ label: "Demo", href: "/speedrun" }',
      "{ href: '/speedrun#join' }",
    ]) {
      expect(INTO_SPEEDRUN.test(bad), bad).toBe(true);
    }
    for (const fine of ['fetch("/speedrun/api/read")', '<a href="/speedrun">', '<a href="/speedrun#join" className="x">', '{ href: "/speedrun/api/read" }']) {
      expect(INTO_SPEEDRUN.test(fine), fine).toBe(false);
    }
  });
});
