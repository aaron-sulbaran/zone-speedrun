import { describe, expect, it, vi } from "vitest";

type Spec = { perKey?: { prefix: string }; prefix?: string; daily?: unknown };

describe("read route limiters", () => {
  it("keeps the daily cap off the per-caller limiter, so a refused body cannot spend it", async () => {
    vi.resetModules();
    const keyed: Spec[] = [];
    const daily: Spec[] = [];
    vi.doMock("botid/server", () => ({ checkBotId: async () => ({ isBot: false }) }));
    vi.doMock("@/lib/speedrun/sharedLimit", () => ({
      upstashMaker: () => () => null,
      createSharedLimiter: (spec: Spec) => {
        keyed.push(spec);
        return async () => ({ ok: true, retryAfterMs: 0 });
      },
      createDailyLimiter: (spec: Spec) => {
        daily.push(spec);
        return async () => ({ ok: true, retryAfterMs: 0 });
      },
    }));
    await import("../../app/api/read/route");
    expect(keyed.map((spec) => spec.perKey?.prefix)).toEqual(["speedrun:read"]);
    expect(keyed[0].daily).toBeUndefined();
    expect(daily.map((spec) => spec.prefix)).toEqual(["speedrun:read:daily"]);
    vi.doUnmock("@/lib/speedrun/sharedLimit");
    vi.doUnmock("botid/server");
  });
});
