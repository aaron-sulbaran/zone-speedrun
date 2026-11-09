import { describe, expect, it, vi } from "vitest";
import { handleBrief, readBriefBody, sendWithResend, type BriefDeps } from "./briefHandler";
import { BODY_CAPS } from "./guard";
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

const accepted = { status: 202, body: { accepted: true } };
const run = async (body: unknown, over: Partial<BriefDeps> = {}) => {
  const result = await handleBrief(body, deps(over));
  await result.deliver?.();
  return result;
};
const allowOk = async () => ({ ok: true, retryAfterMs: 0 });
const first = (mock: { mock: { calls: unknown[][] } }, n = 0) => (mock.mock.calls[n] as unknown as [{ to: string; subject: string; html: string; text: string }])[0];

describe("handleBrief", () => {
  it("503 email_off when the switch is off, before any other work", async () => {
    const isBot = vi.fn(async () => false);
    const { outcome, deliver } = await handleBrief(BODY, deps({ live: false, isBot }));
    expect(outcome).toEqual({ status: 503, body: { error: "email_off" } });
    expect(deliver).toBeNull();
    expect(isBot).not.toHaveBeenCalled();
  });

  it("403 bot", async () => {
    const send = vi.fn(async () => true);
    const { outcome, deliver } = await handleBrief(BODY, deps({ isBot: async () => true, send }));
    expect(outcome).toEqual({ status: 403, body: { error: "bot" } });
    expect(deliver).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("400 bad_input for a bad address, an unknown person, or no body", async () => {
    for (const body of [{ email: "nope", personKey: "sam", connected: true, roleIds: [] }, { email: "a@example.com", personKey: "you", connected: true, roleIds: [] }, { email: "a@example.com", personKey: "sam", connected: true }, { ...BODY, roleIds: ["1", "2", "3", "4", "5", "6", "7"] }, null, "x"]) {
      const { outcome, deliver } = await handleBrief(body, deps());
      expect(outcome).toEqual({ status: 400, body: { error: "bad_input" } });
      expect(deliver).toBeNull();
    }
  });

  it("429 with deliver null when the caller's own address is over its limit, before any list or address work", async () => {
    const allow = vi.fn(allowOk);
    const allowed = vi.fn(() => true);
    const send = vi.fn(async () => true);
    const { outcome, deliver } = await handleBrief(BODY, deps({ allow, allowed, send, allowIp: async () => ({ ok: false, retryAfterMs: 9000 }) }));
    expect(outcome).toEqual({ status: 429, body: { error: "slow_down", retryAfterMs: 9000 } });
    expect(deliver).toBeNull();
    expect(allow).not.toHaveBeenCalled();
    expect(allowed).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("answers an on-list and an off-list valid submission with byte-identical responses", async () => {
    const on = await handleBrief(BODY, deps({ allowed: () => true }));
    const off = await handleBrief(BODY, deps({ allowed: () => false }));
    expect(on.outcome).toEqual(accepted);
    expect(JSON.stringify(off.outcome)).toBe(JSON.stringify(on.outcome));
    expect(on.deliver).toBeTypeOf("function");
    expect(off.deliver).toBeTypeOf("function");
  });

  it("the off-list deliver calls neither the address limiter nor send, and notes it once", async () => {
    const allow = vi.fn(allowOk);
    const send = vi.fn(async () => true);
    const note = vi.fn();
    const allowed = vi.fn(() => false);
    await run(BODY, { allowed, allow, send, note });
    expect(allowed).toHaveBeenCalledWith("ada@example.com");
    expect(allow).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(note.mock.calls).toEqual([["not_on_list"]]);
  });

  it("the on-list deliver calls the address limiter and send once each, with nothing noted", async () => {
    const allow = vi.fn(allowOk);
    const send = vi.fn(async () => true);
    const note = vi.fn();
    await run(BODY, { allow, send, note });
    expect(allow).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(note).not.toHaveBeenCalled();
  });

  it("nothing is spent before deliver runs", async () => {
    const allow = vi.fn(allowOk);
    const send = vi.fn(async () => true);
    await handleBrief(BODY, deps({ allow, send }));
    expect(allow).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("deliver notes throttled when the address limiter refuses, and sends nothing", async () => {
    const send = vi.fn(async () => true);
    const note = vi.fn();
    const { outcome } = await run(BODY, { allow: async () => ({ ok: false, retryAfterMs: 5000 }), send, note });
    expect(outcome).toEqual(accepted);
    expect(send).not.toHaveBeenCalled();
    expect(note.mock.calls).toEqual([["throttled"]]);
  });

  it("deliver notes send_failed when the sender says no or throws, and never throws itself", async () => {
    const note = vi.fn();
    await run(BODY, { send: async () => false, note });
    await run(BODY, { send: async () => { throw new Error("x"); }, note });
    expect(note.mock.calls).toEqual([["send_failed"], ["send_failed"]]);
  });

  it("keys the limiter on a digest, never the address itself", async () => {
    const allow = vi.fn(allowOk);
    await run({ email: "Ada@Example.com", personKey: "sam", connected: true, roleIds: [] }, { allow });
    await run({ email: "ada@example.com", personKey: "sam", connected: true, roleIds: [] }, { allow });
    const [one, two] = allow.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(one).toBe(two);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(one).not.toBe("ada@example.com");
  });

  it("builds the same brief the page shows, using connected", async () => {
    const send = vi.fn(async () => true);
    await run({ ...BODY, connected: false }, { send });
    expect(first(send).subject).toBe("Sam, nothing moved. that's fine.");
  });

  it("takes the role from the request's ids, and drops unknown ones", async () => {
    const send = vi.fn(async () => true);
    const role = getSnapshot().roles.find((r) => r.tier === "speedrun")!;
    await run({ ...BODY, connected: false, roleIds: ["unknown-id", role.id] }, { send });
    expect(first(send).text).toContain(`${role.title} at ${role.company}`);
    await run({ ...BODY, connected: false, roleIds: ["unknown-id"] }, { send });
    expect(first(send, 1).text).not.toContain("fits you");
  });

  it("keeps a full request under the body cap", () => {
    const body = JSON.stringify({ email: `${"a".repeat(240)}@example.com`, personKey: "sam", connected: true, roleIds: Array(6).fill(getSnapshot().roles[0].id) });
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(BODY_CAPS.brief);
  });

  it("sends a fixed template built from the sample person", async () => {
    const send = vi.fn(async () => true);
    await run(BODY, { send });
    const message = first(send);
    expect(message.to).toBe("ada@example.com");
    expect(message.subject).toContain("Sam");
    expect(message.html).not.toContain("<script");
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
