import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BodyTooLargeError, handleRead, MAX_BODY_BYTES, MAX_TEXT_CHARS, readCappedJson, type ReadDeps, type ReadInput } from "./readHandler";

const INTAKE = { targets: ["engineering"], places: [], why: "" };
const RESUME =
  "Ada Lovelace\nSKILLS\nTypeScript, Postgres, React\nEXPERIENCE\nBuilt a billing API in TypeScript and shipped it to customers.";

function deps(over: Partial<ReadDeps> = {}): ReadDeps {
  return { live: true, isBot: async () => false, allow: () => ({ ok: true, retryAfterMs: 0 }), model: null, ...over };
}

function input(body: unknown, contentLength: number | null = null): ReadInput {
  return { contentLength, json: async () => body };
}

const ok = { text: RESUME, intake: INTAKE };

afterEach(() => vi.restoreAllMocks());

describe("handleRead", () => {
  it("503 live_off first, before any other work", async () => {
    const isBot = vi.fn(async () => false);
    const out = await handleRead(input(ok), deps({ live: false, isBot }));
    expect(out).toEqual({ status: 503, body: { error: "live_off" } });
    expect(isBot).not.toHaveBeenCalled();
  });

  it("403 bot", async () => {
    expect(await handleRead(input(ok), deps({ isBot: async () => true }))).toEqual({ status: 403, body: { error: "bot" } });
  });

  it("429 with retryAfterMs", async () => {
    const out = await handleRead(input(ok), deps({ allow: () => ({ ok: false, retryAfterMs: 4000 }) }));
    expect(out).toEqual({ status: 429, body: { error: "slow_down", retryAfterMs: 4000 } });
  });

  it("400 bad_input for bad JSON, a wrong shape, a missing or wrong intake", async () => {
    const broken = await handleRead({ contentLength: null, json: async () => { throw new SyntaxError("x"); } }, deps());
    const noText = await handleRead(input({ intake: INTAKE }), deps());
    const noIntake = await handleRead(input({ text: RESUME }), deps());
    const wrong = await handleRead(input({ text: RESUME, intake: { ...INTAKE, targets: ["plumbing"] } }), deps());
    for (const out of [broken, noText, noIntake, wrong]) expect(out).toEqual({ status: 400, body: { error: "bad_input" } });
  });

  it("413 too_large for long text, a big declared length, and a body past the byte cap", async () => {
    const longText = await handleRead(input({ text: "a".repeat(MAX_TEXT_CHARS + 1), intake: INTAKE }), deps());
    const declared = await handleRead(input(ok, MAX_BODY_BYTES + 1), deps());
    const capped = await handleRead({ contentLength: null, json: async () => { throw new BodyTooLargeError("x"); } }, deps());
    for (const out of [longText, declared, capped]) expect(out).toEqual({ status: 413, body: { error: "too_large" } });
  });

  it("422 unreadable when the browser got no text", async () => {
    const flagged = await handleRead(input({ ...ok, unreadable: true }), deps());
    const empty = await handleRead(input({ text: "  \n ", intake: INTAKE }), deps());
    for (const out of [flagged, empty]) expect(out).toEqual({ status: 422, body: { error: "unreadable" } });
  });

  it("200 with the rules reader when there is no model", async () => {
    const out = await handleRead(input(ok), deps());
    expect(out.status).toBe(200);
    if (out.status !== 200) return;
    expect(out.body.mode).toBe("rules");
    expect(out.body.result.matches.length).toBeLessThanOrEqual(6);
  });

  it("does not ask the model a second time after the read fell back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("down"); } });
    const out = await handleRead(input(ok), deps({ model }));
    expect(out.status === 200 && out.body.mode).toBe("rules");
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});

describe("readCappedJson", () => {
  const post = (body: BodyInit) => new Request("http://x.test/", { method: "POST", body });

  it("parses a small body", async () => {
    expect(await readCappedJson(post(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
  });

  it("stops past the cap even without a content-length", async () => {
    await expect(readCappedJson(post("x".repeat(200)), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("rejects a body that is not JSON", async () => {
    await expect(readCappedJson(post("nope"))).rejects.toBeInstanceOf(SyntaxError);
  });
});
