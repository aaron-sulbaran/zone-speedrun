import { describe, expect, it, vi } from "vitest";
import { handleBrief, sendWithResend, type BriefDeps } from "./briefHandler";
import { createLimiter } from "./guard";

const BODY = { email: "ada@example.com", personKey: "sam" };

function deps(over: Partial<BriefDeps> = {}): BriefDeps {
  return {
    live: true,
    isBot: async () => false,
    allow: () => ({ ok: true, retryAfterMs: 0 }),
    send: vi.fn(async () => true),
    ...over,
  };
}

describe("handleBrief", () => {
  it("503 email_off when the switch is off, before any other work", async () => {
    const isBot = vi.fn(async () => false);
    const out = await handleBrief(BODY, deps({ live: false, isBot }));
    expect(out).toEqual({ status: 503, body: { error: "email_off" } });
    expect(isBot).not.toHaveBeenCalled();
  });

  it("403 bot", async () => {
    const send = vi.fn(async () => true);
    const out = await handleBrief(BODY, deps({ isBot: async () => true, send }));
    expect(out).toEqual({ status: 403, body: { error: "bot" } });
    expect(send).not.toHaveBeenCalled();
  });

  it("400 bad_input for a bad address, an unknown person, or no body", async () => {
    for (const body of [{ email: "nope", personKey: "sam" }, { email: "a@b.co", personKey: "you" }, { email: "a@b.co" }, null, "x"]) {
      const out = await handleBrief(body, deps());
      expect(out).toEqual({ status: 400, body: { error: "bad_input" } });
    }
  });

  it("429 with retryAfterMs when the limiter refuses", async () => {
    const out = await handleBrief(BODY, deps({ allow: () => ({ ok: false, retryAfterMs: 5000 }) }));
    expect(out).toEqual({ status: 429, body: { error: "slow_down", retryAfterMs: 5000 } });
  });

  it("keys the limiter on a digest, never the address itself", async () => {
    const allow = vi.fn(() => ({ ok: true, retryAfterMs: 0 }));
    await handleBrief({ email: "Ada@Example.com", personKey: "sam" }, deps({ allow }));
    await handleBrief({ email: "ada@example.com", personKey: "sam" }, deps({ allow }));
    const [first, second] = allow.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(first).toBe(second);
    expect(first).not.toContain("ada");
  });

  it("502 send_failed when the sender says no", async () => {
    const out = await handleBrief(BODY, deps({ send: async () => false }));
    expect(out).toEqual({ status: 502, body: { error: "send_failed" } });
  });

  it("sends a fixed template built from the sample person", async () => {
    const send = vi.fn(async () => true);
    const out = await handleBrief(BODY, deps({ send }));
    expect(out).toEqual({ status: 200, body: { sent: true } });
    const message = (send.mock.calls[0] as unknown as [{ to: string; subject: string; html: string; text: string }])[0];
    expect(message.to).toBe("ada@example.com");
    expect(message.subject).toContain("Sam");
    expect(message.html).not.toContain("<script");
  });

  it("allows three sends an hour to one address and not a fourth", async () => {
    const limit = createLimiter({ windowMs: 3_600_000, max: 3, dailyMax: 50 });
    const run = () => handleBrief(BODY, deps({ allow: (key) => limit(key, 1000) }));
    expect([(await run()).status, (await run()).status, (await run()).status]).toEqual([200, 200, 200]);
    expect((await run()).status).toBe(429);
  });
});

describe("sendWithResend", () => {
  const message = { to: "ada@example.com", subject: "s", html: "<p>h</p>", text: "t" };
  const env = { apiKey: "test-key", from: "Brief <brief@example.com>" };

  it("posts the documented shape to the Resend API", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: "fake-id" }), { status: 200 }));
    expect(await sendWithResend(message, env, fetcher as unknown as typeof fetch)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string)).toEqual({
      from: env.from,
      to: ["ada@example.com"],
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
  });

  it("is false on a non-2xx answer or a thrown fetch", async () => {
    const bad = vi.fn(async () => new Response("{}", { status: 422 }));
    expect(await sendWithResend(message, env, bad as unknown as typeof fetch)).toBe(false);
    const boom = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await sendWithResend(message, env, boom as unknown as typeof fetch)).toBe(false);
  });
});
