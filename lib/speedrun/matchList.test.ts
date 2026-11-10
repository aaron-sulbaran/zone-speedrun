import { describe, expect, it } from "vitest";
import { FOUNDER_KEY, listItems, matchKey, moveSelection, reasonLine } from "./matchList";
import type { Match, MatchResult } from "./match";

const fake = (name: string, roleId: string | null, reasons: string[] = []): Match =>
  ({
    company: { name, slug: name.toLowerCase(), logo: null, cohort: null, stage: null, blurb: `${name} blurb` },
    role: roleId ? { id: roleId } : null,
    score: 1,
    reasons: reasons.map((text) => ({ text, cites: [] })),
    connect: [],
  }) as unknown as Match;

const result = (matches: Match[], routes: number): MatchResult =>
  ({
    matches,
    routes: Array.from({ length: routes }, () => ({ kind: "speedrun", url: "https://x.test" })),
    narrowing: { companies: 0, roles: 0, speedrunRoles: 0, a16zRoles: 0, afterFilters: 0, shown: matches.length },
  }) as MatchResult;

const a = fake("Alpha", "r1", ["because"]);
const b = fake("Beta", null);

describe("listItems", () => {
  it("leads with the founder item only when there are routes", () => {
    expect(listItems(result([a, b], 1))[0]).toEqual({ key: FOUNDER_KEY, kind: "founder" });
    expect(listItems(result([a, b], 0)).map((i) => i.kind)).toEqual(["match", "match"]);
  });

  it("gives every item a unique key", () => {
    const keys = listItems(result([a, b], 2)).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(matchKey(b)).toBe("Beta-company");
    expect(matchKey(a)).toBe("Alpha-r1");
  });
});

describe("moveSelection", () => {
  const items = listItems(result([a, b], 1));
  const last = items[items.length - 1].key;

  it("clamps at both ends", () => {
    expect(moveSelection(items, last, "down")).toBe(last);
    expect(moveSelection(items, items[0].key, "up")).toBe(items[0].key);
    expect(moveSelection(items, items[0].key, "down")).toBe(items[1].key);
  });

  it("starts at the first key for an unknown or null current", () => {
    expect(moveSelection(items, "nope", "down")).toBe(items[0].key);
    expect(moveSelection(items, null, "up")).toBe(items[0].key);
  });

  it("returns null for an empty list", () => {
    expect(moveSelection([], null, "down")).toBeNull();
    expect(moveSelection([], "x", "up")).toBeNull();
  });
});

describe("reasonLine", () => {
  it("uses the first reason, else the blurb", () => {
    expect(reasonLine(a)).toBe("because");
    expect(reasonLine(b)).toBe("Beta blurb");
  });
});
