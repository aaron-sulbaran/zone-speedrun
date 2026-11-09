import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDailyLimiter, createSharedLimiter, upstashMaker, type RatelimitLike } from "./sharedLimit";

const IP = "203.0.113.9";
const digest = createHash("sha256").update(IP).digest("hex");
type Result = { success: boolean; reset: number; reason?: string };

function fake(script: Result[] | (() => Result)) {
  const keys: string[] = [];
  let i = 0;
  const rl: RatelimitLike = {
    limit: async (key) => {
      keys.push(key);
      if (typeof script === "function") return script();
      return script[Math.min(i++, script.length - 1)];
    },
  };
  return { rl, keys };
}

const perKey = { prefix: "sr:read", max: 3, window: "10 s" } as const;
const daily = { prefix: "sr:read:day", max: 100 };
const ok: Result = { success: true, reset: 0 };

function build(per: ReturnType<typeof fake>, day?: ReturnType<typeof fake>, log: (l: string) => void = () => {}) {
  return createSharedLimiter(
    { perKey, daily },
    { make: (w) => (w.kind === "daily" ? (day ?? fake([ok])).rl : per.rl), now: () => 1000, log },
  );
}

describe("upstashMaker", () => {
  it("returns a null maker for no store", () => {
    expect(upstashMaker(null)({ kind: "daily", prefix: "p", max: 1 })).toBeNull();
  });
  it("builds a 1000 ms timeout limiter without touching the network", () => {
    const rl = upstashMaker({ url: "https://example.invalid", token: "t" })({ kind: "perKey", ...perKey });
    expect((rl as unknown as { timeout: number }).timeout).toBe(1000);
  });
  it("does not throw on a bad URL, and the limiter denies", async () => {
    const lines: string[] = [];
    const make = upstashMaker({ url: "https://bad host\n", token: "secret-token" });
    const lim = createSharedLimiter({ perKey, daily }, { make, log: (l) => lines.push(l) });
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(lines.join("")).not.toContain("secret-token");
  });
});

describe("createSharedLimiter", () => {
  it("allows when both pass", async () => {
    const lim = build(fake([ok]));
    expect(await lim(IP)).toEqual({ ok: true, retryAfterMs: 0 });
  });
  it("denies a per-key overflow with the reset delay", async () => {
    const lim = build(fake([{ success: false, reset: 6000 }]));
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 5000 });
  });
  it("denies on the daily cap after the per-key window passes", async () => {
    const lim = build(fake([ok]), fake([{ success: false, reset: 11000 }]));
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 10000 });
  });
  it("a per-key denial never calls the daily fake", async () => {
    const day = fake([ok]);
    const lim = build(fake([{ success: false, reset: 6000 }]), day);
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 5000 });
    expect(day.keys).toEqual([]);
  });
  it("a past reset gives retryAfterMs 1", async () => {
    expect(await build(fake([{ success: false, reset: 10 }]))(IP)).toEqual({ ok: false, retryAfterMs: 1 });
  });
  it("a timeout on the daily step denies", async () => {
    const lim = build(fake([ok]), fake([{ success: true, reset: 0, reason: "timeout" }]));
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 60_000 });
  });
  it("denies when only the daily limiter is null", async () => {
    const lim = createSharedLimiter(
      { perKey, daily },
      { make: (w) => (w.kind === "daily" ? null : fake([ok]).rl), log: () => {} },
    );
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 60_000 });
  });
  it("treats a timeout as a denial and logs once", async () => {
    const lines: string[] = [];
    const lim = build(fake([{ success: true, reset: 0, reason: "timeout" }]), undefined, (l) => lines.push(l));
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(lines).toEqual(["[speedrun] limits unavailable"]);
  });
  it("treats a throw as a denial", async () => {
    const lines: string[] = [];
    const lim = build(fake(() => { throw new Error("boom " + IP); }), undefined, (l) => lines.push(l));
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(lines).toEqual(["[speedrun] limits unavailable"]);
  });
  it("denies every call when there is no store", async () => {
    const lim = createSharedLimiter({ perKey, daily }, { make: () => null, log: () => {} });
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(await lim("x")).toEqual({ ok: false, retryAfterMs: 60_000 });
  });
  it("sends only the SHA-256 digest, never the raw key", async () => {
    const per = fake([ok]);
    const day = fake([ok]);
    const lines: string[] = [];
    await build(per, day, (l) => lines.push(l))(IP);
    expect(per.keys).toEqual([digest]);
    expect(day.keys).toEqual(["daily"]);
    expect([...per.keys, ...day.keys].join("")).not.toContain(IP);
    expect(lines.join("")).not.toContain(IP);
  });
});

describe("createDailyLimiter", () => {
  const spec = { prefix: "sr:day", max: 5 };
  const build = (day: ReturnType<typeof fake> | null, log: (l: string) => void = () => {}) =>
    createDailyLimiter(spec, { make: (w) => (w.kind === "daily" && day ? day.rl : null), now: () => 1000, log });

  it("takes one slot on the fixed key, never an address", async () => {
    const day = fake([ok]);
    expect(await build(day)()).toEqual({ ok: true, retryAfterMs: 0 });
    expect(day.keys).toEqual(["daily"]);
  });
  it("denies with the reset delay when the day is full", async () => {
    expect(await build(fake([{ success: false, reset: 11000 }]))()).toEqual({ ok: false, retryAfterMs: 10000 });
  });
  it("fails closed on a timeout, a throw and a missing store", async () => {
    const lines: string[] = [];
    expect(await build(fake([{ success: true, reset: 0, reason: "timeout" }]), (l) => lines.push(l))()).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(await build(fake(() => { throw new Error("boom"); }), (l) => lines.push(l))()).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(await build(null, (l) => lines.push(l))()).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(lines).toEqual(Array(3).fill("[speedrun] limits unavailable"));
  });
});
