import { afterEach, describe, expect, it, vi } from "vitest";

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
    await import("../../app/api/brief/route");
    const to = specs.find((spec) => spec.perKey.prefix === "speedrun:brief:to");
    const ip = specs.find((spec) => spec.perKey.prefix === "speedrun:brief:ip");
    expect(to?.daily?.prefix).toBe("speedrun:brief:daily");
    expect(ip?.daily).toBeUndefined();
    vi.doUnmock("@/lib/speedrun/sharedLimit");
    vi.doUnmock("botid/server");
  });
});

describe("brief route end to end, with fakes", () => {
  const ON = "ada@example.com";
  const body = (email: string) => JSON.stringify({ email, personKey: "sam", connected: true, roleIds: [] });
  const post = (route: { POST: (r: Request) => Promise<Response> }, email: string, ip: string) =>
    route.POST(new Request("http://x/speedrun/api/brief", { method: "POST", body: body(email), headers: { "x-forwarded-for": ip } }));

  async function load() {
    vi.resetModules();
    const callbacks: (() => unknown)[] = [];
    const counts = new Map<string, number>();
    const keys: string[] = [];
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    for (const [name, value] of Object.entries({
      SPEEDRUN_EMAIL: "on",
      RESEND_API_KEY: "test-key",
      SPEEDRUN_EMAIL_FROM: "Brief <brief@example.com>",
      KV_REST_API_URL: "https://store.example.invalid",
      KV_REST_API_TOKEN: "test-token",
      SPEEDRUN_BRIEF_ALLOW: ON,
    })) vi.stubEnv(name, value);
    vi.doMock("botid/server", () => ({ checkBotId: async () => ({ isBot: false }) }));
    vi.doMock("next/server", async () => ({
      ...(await vi.importActual<object>("next/server")),
      after: (callback: () => unknown) => void callbacks.push(callback),
    }));
    // The route's own limiter specs go to the REAL limiter; only the store behind it is fake.
    vi.doMock("@/lib/speedrun/sharedLimit", async () => {
      const actual = await vi.importActual<typeof import("./sharedLimit")>("./sharedLimit");
      return {
        ...actual,
        upstashMaker: () => (w: { kind: string; prefix: string; max: number }) => ({
          limit: async (key: string) => {
            keys.push(key);
            const id = `${w.prefix}:${key}`;
            const used = (counts.get(id) ?? 0) + 1;
            counts.set(id, used);
            return { success: used <= w.max, reset: Date.now() + 3_600_000 };
          },
        }),
      };
    });
    const route = await import("../../app/api/brief/route");
    return { route, callbacks, fetcher, keys };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock("next/server");
    vi.doUnmock("@/lib/speedrun/sharedLimit");
    vi.doUnmock("botid/server");
  });

  it("gives an on-list and an off-list address identical status, body and headers, and defers delivery to after()", async () => {
    const { route, callbacks, fetcher } = await load();
    const on = await post(route, ON, "203.0.113.1");
    const off = await post(route, "stranger@example.com", "203.0.113.2");
    expect(on.status).toBe(202);
    expect(await on.clone().text()).toBe(await off.clone().text());
    expect(await on.json()).toEqual({ accepted: true });
    expect(off.status).toBe(on.status);
    expect([...off.headers.entries()]).toEqual([...on.headers.entries()]);
    // Both responses are out while the delivery callbacks have not run.
    expect(callbacks).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
    for (const callback of callbacks) await callback();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends three an hour to one address and not a fourth, through the route's own limiter specs", async () => {
    const { route, callbacks, fetcher, keys } = await load();
    // A different caller each time, so the caller window cannot mask a missing address limit.
    for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"]) {
      expect((await post(route, ON, ip)).status).toBe(202);
    }
    for (const callback of callbacks) await callback();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(keys.join("")).not.toContain(ON);
  });
});
