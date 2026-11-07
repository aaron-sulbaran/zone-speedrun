import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSnapshot } from "./snapshot";

describe("speedrun snapshot", () => {
  const snapshot = getSnapshot();

  it("parses and carries the companies", () => {
    expect(snapshot.companies.length).toBeGreaterThanOrEqual(40);
  });

  it("has speedrun tier roles", () => {
    expect(snapshot.roles.some((role) => role.tier === "speedrun")).toBe(true);
  });

  it("never keeps a blocked listing url", () => {
    expect(snapshot.roles.filter((role) => role.url.includes("-ad00000"))).toEqual([]);
  });

  it("points every logo at a file that exists", () => {
    for (const company of snapshot.companies) {
      if (company.logo) {
        expect(existsSync(path.join(process.cwd(), "public", company.logo))).toBe(true);
      }
    }
  });
});
