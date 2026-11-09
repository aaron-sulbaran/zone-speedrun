import { describe, expect, it } from "vitest";
import { isAllowed, parseAllowlist } from "./recipients";

describe("parseAllowlist", () => {
  it("trims, lowercases and drops empty entries", () => {
    expect(parseAllowlist(" A@Example.com , @team.example ,, ")).toEqual(["a@example.com", "@team.example"]);
  });

  it("drops wildcards and bare domains", () => {
    expect(parseAllowlist("*, example.com, *@example.com, @, a@, @@x.test, ok@example.com")).toEqual(["ok@example.com"]);
  });

  it("is empty for undefined or blank input", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("  , ")).toEqual([]);
  });
});

describe("isAllowed", () => {
  const list = parseAllowlist("a@example.com, @team.example");

  it("matches an exact address, ignoring case", () => {
    expect(isAllowed("a@example.com", list)).toBe(true);
    expect(isAllowed("A@EXAMPLE.COM", list)).toBe(true);
  });

  it("matches anyone at an allowed domain", () => {
    expect(isAllowed("x@team.example", list)).toBe(true);
  });

  it("refuses a subdomain of an allowed domain", () => {
    expect(isAllowed("x@sub.team.example", list)).toBe(false);
  });

  it("refuses other addresses and lookalike domains", () => {
    expect(isAllowed("x@example.com", list)).toBe(false);
    expect(isAllowed("x@evilteam.example", list)).toBe(false);
    expect(isAllowed("x@team.example.evil.example", list)).toBe(false);
  });

  it("uses the domain after the last @", () => {
    expect(isAllowed("x@team.example@evil.example", list)).toBe(false);
  });

  it("refuses everything on an empty list", () => {
    expect(isAllowed("a@example.com", [])).toBe(false);
  });
});
