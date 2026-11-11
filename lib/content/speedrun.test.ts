import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import { AARON_ENTRIES } from "@/lib/speedrun/aaronMock";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("speedrunCopy", () => {
  // Catches: a hard-coded 84 in the subtitle drifting from the chart's applications.
  it("states the application count from the mock's entries", () => {
    expect(speedrunCopy.act1.subtitle.count(AARON_ENTRIES.length)).toContain(`${AARON_ENTRIES.length} applications`);
    expect(speedrunCopy.act1.subtitle.count(AARON_ENTRIES.length)).toContain("84 applications");
  });

  // Catches: an em dash slipping into any copy string, which the site forbids.
  it("has no em dash in any string", () => {
    const all = strings(speedrunCopy);
    expect(all.length).toBeGreaterThan(50);
    for (const text of all) expect(text).not.toContain("\u2014");
    expect(strings(speedrunCopy.act1.subtitle.count(7)).join("")).not.toContain("\u2014");
  });
});
