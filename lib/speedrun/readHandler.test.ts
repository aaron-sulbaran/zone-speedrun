import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BodyTooLargeError, handleRead, MAX_TEXT_CHARS, readBodySchema, type ReadDeps, type ReadInput } from "./readHandler";
import { BODY_CAPS } from "./guard";

const INTAKE = { targets: ["engineering"], places: [], why: "" };
const RESUME =
  "Ada Lovelace\nSKILLS\nTypeScript, Postgres, React\nEXPERIENCE\nBuilt a billing API in TypeScript and shipped it to customers.";

function deps(over: Partial<ReadDeps> = {}): ReadDeps {
  return { live: true, isBot: async () => false, allow: async () => ({ ok: true, retryAfterMs: 0 }), model: null, ...over };
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
    const out = await handleRead(input(ok), deps({ allow: async () => ({ ok: false, retryAfterMs: 4000 }) }));
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
    const declared = await handleRead(input(ok, BODY_CAPS.read + 1), deps());
    const capped = await handleRead({ contentLength: null, json: async () => { throw new BodyTooLargeError("x"); } }, deps());
    for (const out of [longText, declared, capped]) expect(out).toEqual({ status: 413, body: { error: "too_large" } });
  });

  it("422 unreadable when the browser got no text", async () => {
    const empty = await handleRead(input({ text: "  \n ", intake: INTAKE }), deps());
    expect(empty).toEqual({ status: 422, body: { error: "unreadable" } });
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

  it("accepts the student and founding answers and rejects a bad seniority", async () => {
    const intake = { ...INTAKE, seniority: "intern", founding: true };
    expect((await handleRead(input({ text: RESUME, intake }), deps())).status).toBe(200);
    const bad = await handleRead(input({ text: RESUME, intake: { ...INTAKE, seniority: "senior" } }), deps());
    expect(bad).toEqual({ status: 400, body: { error: "bad_input" } });
  });

  it("strips unknown keys, a name included, from the parsed intake", () => {
    const parsed = readBodySchema.parse({ text: RESUME, intake: { ...INTAKE, name: "Zelda Quinn", founding: false } });
    expect(parsed.intake).toEqual({ ...INTAKE, founding: false });
    expect("name" in parsed.intake).toBe(false);
  });

  it("tells the reranker the visitor's seniority, not the resume's", async () => {
    const profile = {
      firstName: "Ada", headline: "Backend engineer", functions: ["engineering"], seniority: "junior", skills: ["TypeScript"],
      shipped: ["A billing API"], locations: [], remoteOk: true, founderSignal: { score: 0.1, evidence: [] },
    };
    const replies = [JSON.stringify(profile), JSON.stringify({ ranked: [] })];
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text" as const, text: replies[Math.min(calls++, 1)] }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 10, text: 10, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    const out = await handleRead(input({ text: RESUME, intake: { ...INTAKE, seniority: "intern" } }), deps({ model }));
    expect(out.status === 200 && out.body.mode).toBe("model");
    expect(model.doGenerateCalls).toHaveLength(2);
    const rerankPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(rerankPrompt).toContain('\\"seniority\\":\\"intern\\"');
    expect(rerankPrompt).not.toContain('\\"seniority\\":\\"junior\\"');
  });
});
