import { describe, expect, it } from "vitest";
import { POST } from "../../app/speedrun/api/match/route";

const post = (body: string) => new Request("http://x.test/speedrun/api/match", { method: "POST", body, headers: { "x-forwarded-for": "9.9.9.9" } });

describe("match route body cap", () => {
  it("413 too_large for a body past the cap", async () => {
    const response = await POST(post(JSON.stringify({ intake: { targets: [], places: [], why: "x".repeat(40_000) }, personKey: "sam" })));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large" });
  });

  it("400 for a body that is not JSON, 200 for a valid one", async () => {
    expect((await POST(post("nope"))).status).toBe(400);
    const ok = await POST(post(JSON.stringify({ intake: { targets: ["engineering"], places: [], why: "" }, personKey: "sam" })));
    expect(ok.status).toBe(200);
  });
});
