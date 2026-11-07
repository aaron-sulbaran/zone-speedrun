import { afterEach, describe, expect, it, vi } from "vitest";
import { BodyTooLargeError, createLimiter, liveFlags, readCappedJson } from "./guard";

const TEN_MIN = 10 * 60 * 1000;

describe("createLimiter", () => {
  it("refuses the sixth call inside the window with a positive wait", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 5, dailyMax: 300 });
    for (let i = 0; i < 5; i += 1) expect(limit("a", 1000 + i).ok).toBe(true);
    const sixth = limit("a", 2000);
    expect(sixth.ok).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });

  it("counts each address on its own", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 1, dailyMax: 300 });
    expect(limit("a", 0).ok).toBe(true);
    expect(limit("b", 0).ok).toBe(true);
    expect(limit("a", 1).ok).toBe(false);
  });

  it("allows again once a new window starts", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 5, dailyMax: 300 });
    for (let i = 0; i < 5; i += 1) limit("a", i);
    expect(limit("a", 10).ok).toBe(false);
    expect(limit("a", TEN_MIN + 1).ok).toBe(true);
  });

  it("refuses everyone after the daily cap", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 5, dailyMax: 3 });
    expect(limit("a", 0).ok).toBe(true);
    expect(limit("b", 0).ok).toBe(true);
    expect(limit("c", 0).ok).toBe(true);
    const fourth = limit("d", 0);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
    expect(limit("d", 24 * 60 * 60 * 1000 + 1).ok).toBe(true);
  });

  it("does not spend the daily cap on refused calls", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 1, dailyMax: 2 });
    expect(limit("a", 0).ok).toBe(true);
    expect(limit("a", 1).ok).toBe(false);
    expect(limit("a", 2).ok).toBe(false);
    expect(limit("b", 3).ok).toBe(true);
  });
});

describe("createLimiter sweeping", () => {
  it("drops a key once its window has ended, even if that key never returns", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 5, dailyMax: 300 });
    limit("203.0.113.9", 0);
    limit("digest-of-an-address", 1);
    expect(limit.size()).toBe(2);
    limit("someone-else", TEN_MIN + 61_000);
    expect(limit.size()).toBe(1);
  });

  it("evicts the oldest keys at the size cap instead of clearing everyone", () => {
    const limit = createLimiter({ windowMs: TEN_MIN, max: 1, dailyMax: 1_000_000 });
    for (let i = 0; i < 6000; i += 1) limit(`k${i}`, i);
    expect(limit.size()).toBeLessThanOrEqual(5000);
    expect(limit("k5999", 6001).ok).toBe(false);
  });
});

describe("liveFlags", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off by default", () => {
    vi.stubEnv("SPEEDRUN_AI", "");
    vi.stubEnv("SPEEDRUN_EMAIL", "");
    expect(liveFlags()).toEqual({ reading: false, email: false });
  });

  it("does not turn on from key presence alone", () => {
    vi.stubEnv("SPEEDRUN_AI", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "present");
    vi.stubEnv("RESEND_API_KEY", "present");
    vi.stubEnv("SPEEDRUN_EMAIL_FROM", "hi@example.com");
    expect(liveFlags()).toEqual({ reading: false, email: false });
  });

  it("turns reading on only with the explicit flag", () => {
    vi.stubEnv("SPEEDRUN_AI", "on");
    expect(liveFlags().reading).toBe(true);
  });

  it("needs the flag and both email settings", () => {
    vi.stubEnv("SPEEDRUN_EMAIL", "on");
    vi.stubEnv("RESEND_API_KEY", "present");
    vi.stubEnv("SPEEDRUN_EMAIL_FROM", "");
    expect(liveFlags().email).toBe(false);
    vi.stubEnv("SPEEDRUN_EMAIL_FROM", "hi@example.com");
    expect(liveFlags().email).toBe(true);
  });
});

describe("readCappedJson", () => {
  const post = (body: BodyInit, headers?: HeadersInit) => new Request("http://x.test/", { method: "POST", body, headers });

  it("parses a small body", async () => {
    expect(await readCappedJson(post(JSON.stringify({ a: 1 })), 100)).toEqual({ a: 1 });
  });

  it("stops past the cap even without a content-length", async () => {
    await expect(readCappedJson(post("x".repeat(200)), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("refuses a declared length past the cap before reading", async () => {
    await expect(readCappedJson(post("{}", { "content-length": "500" }), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("rejects a body that is not JSON", async () => {
    await expect(readCappedJson(post("nope"), 100)).rejects.toBeInstanceOf(SyntaxError);
  });
});
