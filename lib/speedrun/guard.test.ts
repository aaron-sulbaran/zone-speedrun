import { afterEach, describe, expect, it, vi } from "vitest";
import { BodyTooLargeError, createLimiter, liveFlags, readCappedJson } from "./guard";

const STORE = { KV_REST_API_URL: "https://store.test", KV_REST_API_TOKEN: "token" };
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
    vi.stubEnv("SPEEDRUN_EMAIL", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "present");
    vi.stubEnv("RESEND_API_KEY", "present");
    vi.stubEnv("SPEEDRUN_EMAIL_FROM", "hi@example.com");
    expect(liveFlags({ ...STORE, SPEEDRUN_BRIEF_ALLOW: "a@example.com", AI_GATEWAY_API_KEY: "present", RESEND_API_KEY: "present", SPEEDRUN_EMAIL_FROM: "hi@example.com" })).toEqual({ reading: false, email: false });
    expect(liveFlags()).toEqual({ reading: false, email: false });
  });

  it("needs the flag and both email settings", () => {
    const base = { SPEEDRUN_EMAIL: "on", RESEND_API_KEY: "present", ...STORE, SPEEDRUN_BRIEF_ALLOW: "a@example.com" };
    expect(liveFlags({ ...base, SPEEDRUN_EMAIL_FROM: "" }).email).toBe(false);
    expect(liveFlags({ ...base, SPEEDRUN_EMAIL_FROM: "hi@example.com" }).email).toBe(true);
    expect(liveFlags({ ...base, SPEEDRUN_EMAIL_FROM: "hi@example.com", RESEND_API_KEY: "" }).email).toBe(false);
    expect(liveFlags({ ...base, SPEEDRUN_EMAIL_FROM: "hi@example.com", SPEEDRUN_EMAIL: "" }).email).toBe(false);
  });

  it("reading is off with the switch on and no store", () => {
    expect(liveFlags({ SPEEDRUN_AI: "on" }).reading).toBe(false);
  });

  it("reading is off with only half a store", () => {
    expect(liveFlags({ SPEEDRUN_AI: "on", KV_REST_API_URL: "https://x.test" }).reading).toBe(false);
  });

  it("reading is on with the switch and a store", () => {
    expect(liveFlags({ SPEEDRUN_AI: "on", ...STORE }).reading).toBe(true);
  });

  it("reading is off with a store and the switch off", () => {
    expect(liveFlags({ ...STORE }).reading).toBe(false);
  });

  it("email is off with a store but an empty or unusable allowlist", () => {
    const env = { SPEEDRUN_EMAIL: "on", RESEND_API_KEY: "k", SPEEDRUN_EMAIL_FROM: "hi@example.com", ...STORE };
    expect(liveFlags(env).email).toBe(false);
    expect(liveFlags({ ...env, SPEEDRUN_BRIEF_ALLOW: "*, example.com" }).email).toBe(false);
  });

  it("email is off with every condition but the store", () => {
    const env = { SPEEDRUN_EMAIL: "on", RESEND_API_KEY: "k", SPEEDRUN_EMAIL_FROM: "hi@example.com", SPEEDRUN_BRIEF_ALLOW: "a@example.com" };
    expect(liveFlags(env).email).toBe(false);
  });

  it("email is on with the switch, both email settings, a store and a non-empty allowlist", () => {
    const env = { SPEEDRUN_EMAIL: "on", RESEND_API_KEY: "k", SPEEDRUN_EMAIL_FROM: "hi@example.com", SPEEDRUN_BRIEF_ALLOW: "a@example.com", ...STORE };
    expect(liveFlags(env).email).toBe(true);
  });

  it("logs one line per missing piece per instance, with no values in it", async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fresh = await import("./guard");
    const env = { SPEEDRUN_AI: "on", SPEEDRUN_EMAIL: "on", RESEND_API_KEY: "secret-key", SPEEDRUN_EMAIL_FROM: "hi@example.com" };
    fresh.liveFlags(env);
    fresh.liveFlags(env);
    const lines = warn.mock.calls.map((call) => String(call[0]));
    expect(lines).toHaveLength(3);
    expect(lines.filter((line) => line.includes("store"))).toHaveLength(2);
    expect(lines.filter((line) => line.includes("allowlist"))).toHaveLength(1);
    expect(lines.every((line) => line.startsWith("[speedrun]") && !line.includes("secret-key"))).toBe(true);
    warn.mockRestore();
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
