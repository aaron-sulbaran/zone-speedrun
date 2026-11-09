import { describe, expect, it, vi } from "vitest";

type Spec = { perKey: { prefix: string }; daily?: { prefix: string } };

describe("brief route limiters", () => {
  it("puts the daily cap on the address limiter, not the caller limiter", async () => {
    vi.resetModules();
    const specs: Spec[] = [];
    vi.doMock("botid/server", () => ({ checkBotId: async () => ({ isBot: false }) }));
    vi.doMock("@/lib/speedrun/sharedLimit", () => ({
      upstashMaker: () => () => null,
      createSharedLimiter: (spec: Spec) => {
        specs.push(spec);
        return async () => ({ ok: true, retryAfterMs: 0 });
      },
    }));
    await import("../../app/speedrun/api/brief/route");
    const to = specs.find((spec) => spec.perKey.prefix === "speedrun:brief:to");
    const ip = specs.find((spec) => spec.perKey.prefix === "speedrun:brief:ip");
    expect(to?.daily?.prefix).toBe("speedrun:brief:daily");
    expect(ip?.daily).toBeUndefined();
    vi.doUnmock("@/lib/speedrun/sharedLimit");
    vi.doUnmock("botid/server");
  });
});
