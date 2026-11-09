import { describe, expect, it, vi } from "vitest";
import { handleBrief, readBriefBody, sendWithResend, type BriefDeps } from "./briefHandler";
import { BODY_CAPS } from "./guard";
import { createLimiter } from "./guard";
import { getSnapshot } from "./snapshot";

const BODY = { email: "ada@example.com", personKey: "sam", connected: true, roleIds: [] };

function deps(over: Partial<BriefDeps> = {}): BriefDeps {
  return {
    live: true,
    isBot: async () => false,
    allowed: () => true,
    allow: async () => ({ ok: true, retryAfterMs: 0 }),
    allowIp: async () => ({ ok: true, retryAfterMs: 0 }),
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
    for (const body of [{ email: "nope", personKey: "sam", connected: true, roleIds: [] }, { email: "a@example.com", personKey: "you", connected: true, roleIds: [] }, { email: "a@example.com", personKey: "sam", connected: true }, { ...BODY, roleIds: ["1", "2", "3", "4", "5", "6", "7"] }, null, "x"]) {
      const out = await handleBrief(body, deps());
      expect(out).toEqual({ status: 400, body: { error: "bad_input" } });
    }
  });

  it("429 with retryAfterMs when the limiter refuses", async () => {
    const out = await handleBrief(BODY, deps({ allow: async () => ({ ok: false, retryAfterMs: 5000 }) }));
    expect(out).toEqual({ status: 429, body: { error: "slow_down", retryAfterMs: 5000 } });
  });

  it("keys the limiter on a digest, never the address itself", async () => {
    const allow = vi.fn(async () => ({ ok: true, retryAfterMs: 0 }));
    await handleBrief({ email: "Ada@Example.com", personKey: "sam", connected: true, roleIds: [] }, deps({ allow }));
    await handleBrief({ email: "ada@example.com", personKey: "sam", connected: true, roleIds: [] }, deps({ allow }));
    const [first, second] = allow.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe("ada@example.com");
  });

  it("429 when the caller's own address is over its limit, before the email limiter", async () => {
    const allow = vi.fn(async () => ({ ok: true, retryAfterMs: 0 }));
    const send = vi.fn(async () => true);
    const out = await handleBrief(BODY, deps({ allow, send, allowIp: async () => ({ ok: false, retryAfterMs: 9000 }) }));
    expect(out).toEqual({ status: 429, body: { error: "slow_down", retryAfterMs: 9000 } });
    expect(allow).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("403 not_on_list for an off-list address, with no limiter or send call", async () => {
    const allow = vi.fn(async () => ({ ok: true, retryAfterMs: 0 }));
    const allowIp = vi.fn(async () => ({ ok: true, retryAfterMs: 0 }));
    const send = vi.fn(async () => true);
    const allowed = vi.fn(() => false);
    const out = await handleBrief(BODY, deps({ allowed, allow, allowIp, send }));
    expect(out).toEqual({ status: 403, body: { error: "not_on_list" } });
    expect(allowed).toHaveBeenCalledWith("ada@example.com");
    expect(allow).not.toHaveBeenCalled();
    expect(allowIp).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("builds the same brief the page shows, using connected", async () => {
    const send = vi.fn(async () => true);
    await handleBrief({ ...BODY, connected: false }, deps({ send }));
    const message = (send.mock.calls[0] as unknown as [{ subject: string }])[0];
    expect(message.subject).toBe("Sam, nothing moved. that's fine.");
  });

  it("takes the role from the request's ids, and drops unknown ones", async () => {
    const send = vi.fn(async () => true);
    const first = getSnapshot().roles.find((r) => r.tier === "speedrun")!;
    await handleBrief({ ...BODY, connected: false, roleIds: ["unknown-id", first.id] }, deps({ send }));
    const message = (send.mock.calls[0] as unknown as [{ text: string }])[0];
    expect(message.text).toContain(`${first.title} at ${first.company}`);
    await handleBrief({ ...BODY, connected: false, roleIds: ["unknown-id"] }, deps({ send }));
    const bare = (send.mock.calls[1] as unknown as [{ text: string }])[0];
    expect(bare.text).not.toContain("fits you");
  });

  it("keeps a full request under the body cap", () => {
    const body = JSON.stringify({ email: `${"a".repeat(240)}@example.com`, personKey: "sam", connected: true, roleIds: Array(6).fill(getSnapshot().roles[0].id) });
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(BODY_CAPS.brief);
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
    const run = () => handleBrief(BODY, deps({ allow: async (key) => limit(key, 1000) }));
    expect([(await run()).status, (await run()).status, (await run()).status]).toEqual([200, 200, 200]);
    expect((await run()).status).toBe(429);
  });
});

describe("readBriefBody", () => {
  const post = (body: string, headers: Record<string, string> = {}) => new Request("http://x/", { method: "POST", body, headers });

  it("parses a small body", async () => {
    expect(await readBriefBody(post('{"a":1}'))).toEqual({ body: { a: 1 } });
  });

  it("refuses a declared length over the cap without reading", async () => {
    expect(await readBriefBody(post("{}", { "content-length": String(BODY_CAPS.brief + 1) }))).toEqual({ tooLarge: true });
  });

  it("treats a body that is not JSON as a body the schema will refuse", async () => {
    expect(await readBriefBody(post("nope"))).toEqual({ body: null });
  });

  it("stops reading a body over the cap even with no content-length", async () => {
    const big = "x".repeat(BODY_CAPS.brief * 4);
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
    const request = new Request("http://x/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readBriefBody(request)).toEqual({ tooLarge: true });
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
