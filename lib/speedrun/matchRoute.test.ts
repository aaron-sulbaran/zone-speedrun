import { describe, expect, it } from "vitest";
import { POST } from "../../app/speedrun/api/match/route";

const post = (body: string) => new Request("http://x.test/speedrun/api/match", { method: "POST", body, headers: { "x-forwarded-for": "9.9.9.9" } });

describe("match route limiter", () => {
  it("429 slow_down with a Retry-After once a caller passes 30 a minute", async () => {
    const burst = () => new Request("http://x.test/speedrun/api/match", { method: "POST", body: "{}", headers: { "x-forwarded-for": "8.8.8.8" } });
    let last = await POST(burst());
    for (let i = 0; i < 30; i += 1) last = await POST(burst());
    expect(last.status).toBe(429);
    expect((await last.json()).error).toBe("slow_down");
    expect(Number(last.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("match route body cap", () => {
  it("413 too_large for a body past the cap", async () => {
    const response = await POST(post(JSON.stringify({ intake: { targets: [], places: [], why: "x".repeat(40_000) }, personKey: "sam" })));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large" });
  });

  it("400 for a body that is not JSON, 200 for a valid one", async () => {
    const bad = await POST(post("nope"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "bad_input" });
    const ok = await POST(post(JSON.stringify({ intake: { targets: ["engineering"], places: [], why: "" }, personKey: "sam" })));
    expect(ok.status).toBe(200);
  });
});
