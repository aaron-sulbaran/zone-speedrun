import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSharedLimiter, limitStore, type RatelimitLike } from "./sharedLimit";

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
    { make: (w) => ("window" in w && w.window === "1 d" ? (day ?? fake([ok])).rl : per.rl), now: () => 1000, log },
  );
}

describe("limitStore", () => {
  it("reads the KV pair", () => {
    expect(limitStore({ KV_REST_API_URL: "u", KV_REST_API_TOKEN: "t" })).toEqual({ url: "u", token: "t" });
  });
  it("reads the UPSTASH pair", () => {
    expect(limitStore({ UPSTASH_REDIS_REST_URL: "u2", UPSTASH_REDIS_REST_TOKEN: "t2" })).toEqual({ url: "u2", token: "t2" });
  });
  it("is null for a URL without a token", () => {
    expect(limitStore({ KV_REST_API_URL: "u" })).toBeNull();
    expect(limitStore({ KV_REST_API_URL: "u", KV_REST_API_TOKEN: "" })).toBeNull();
  });
  it("is null for none", () => {
    expect(limitStore({})).toBeNull();
  });
  it("prefers KV when both are set", () => {
    expect(
      limitStore({ KV_REST_API_URL: "u", KV_REST_API_TOKEN: "t", UPSTASH_REDIS_REST_URL: "u2", UPSTASH_REDIS_REST_TOKEN: "t2" }),
    ).toEqual({ url: "u", token: "t" });
  });
  it("never mixes halves of two pairs", () => {
    expect(limitStore({ KV_REST_API_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t2" })).toBeNull();
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
  it("short-circuits on the daily cap", async () => {
    const per = fake([ok]);
    const lim = build(per, fake([{ success: false, reset: 11000 }]));
    expect(await lim(IP)).toEqual({ ok: false, retryAfterMs: 10000 });
    expect(per.keys).toEqual([]);
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
