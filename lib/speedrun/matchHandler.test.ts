import { describe, expect, it } from "vitest";
import { createWindowLimiter, handleMatch } from "./matchHandler";
import { PEOPLE } from "./people";

describe("handleMatch", () => {
  it("returns a profile and ranked matches for a valid body", () => {
    const out = handleMatch({ intake: PEOPLE.dev.intake, personKey: "dev" });
    expect(out.status).toBe(200);
    if (out.status !== 200) return;
    expect(out.body.profile.firstName).toBe("Dev");
    expect(out.body.result.matches.length).toBeGreaterThan(0);
    expect(out.body.result.routes.map((r) => r.kind).sort()).toEqual(["alpha", "speedrun"]);
  });

  it("uses the visitor's answers over the sample person's own", () => {
    const out = handleMatch({ intake: { targets: ["design"], places: [], why: "" }, personKey: "dev" });
    expect(out.status).toBe(200);
  });

  it("rejects an unknown person", () => {
    expect(handleMatch({ intake: PEOPLE.dev.intake, personKey: "nobody" }).status).toBe(400);
  });

  it("rejects a bad function, a missing body and oversized text", () => {
    expect(handleMatch({ intake: { targets: ["wizard"], places: [], why: "" }, personKey: "dev" }).status).toBe(400);
    expect(handleMatch(null).status).toBe(400);
    expect(handleMatch({ intake: { targets: [], places: [], why: "x".repeat(2000) }, personKey: "dev" }).status).toBe(400);
  });
});

describe("createWindowLimiter", () => {
  it("allows 30 a minute per address and resets after the window", () => {
    const limiter = createWindowLimiter(30, 60_000);
    for (let i = 0; i < 30; i++) expect(limiter.allow("1.1.1.1", 1000)).toBe(true);
    expect(limiter.allow("1.1.1.1", 2000)).toBe(false);
    expect(limiter.allow("2.2.2.2", 2000)).toBe(true);
    expect(limiter.allow("1.1.1.1", 62_000)).toBe(true);
  });
});
