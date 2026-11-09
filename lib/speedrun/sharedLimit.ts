import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { LimitVerdict } from "./guard";
import type { LimitStore } from "./limitStore";

export type WindowSpec = { prefix: string; max: number; window: `${number} ${"s" | "m" | "h" | "d"}` };
export type MakeSpec =
  | ({ kind: "perKey" } & WindowSpec)
  | { kind: "daily"; prefix: string; max: number };

export type RatelimitLike = {
  limit: (key: string) => Promise<{ success: boolean; reset: number; reason?: string }>;
};

const UNAVAILABLE_MS = 60_000;

export function createSharedLimiter(
  spec: { perKey: WindowSpec; daily?: { prefix: string; max: number } },
  deps: {
    make: (w: MakeSpec) => RatelimitLike | null;
    now?: () => number;
    log?: (line: string) => void;
  },
): (key: string) => Promise<LimitVerdict> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((line: string) => console.warn(line));
  const perKeyLimiter = deps.make({ kind: "perKey", ...spec.perKey });
  const dailyLimiter = spec.daily ? deps.make({ kind: "daily", ...spec.daily }) : undefined;

  const unavailable = (): LimitVerdict => {
    log("[speedrun] limits unavailable");
    return { ok: false, retryAfterMs: UNAVAILABLE_MS };
  };

  return async (key) => {
    if (!perKeyLimiter || (spec.daily && !dailyLimiter)) return unavailable();
    const digest = createHash("sha256").update(key).digest("hex");
    try {
      // Per-key first: only a request that passes its own window spends a daily slot.
      const steps: [RatelimitLike, string][] = [[perKeyLimiter, digest]];
      if (dailyLimiter) steps.push([dailyLimiter, "daily"]);
      for (const [limiter, limiterKey] of steps) {
        const result = await limiter.limit(limiterKey);
        // Upstash lets a timed-out request through; here that is a denial.
        if (result.reason === "timeout") return unavailable();
        if (!result.success) return { ok: false, retryAfterMs: Math.max(1, result.reset - now()) };
      }
      return { ok: true, retryAfterMs: 0 };
    } catch {
      return unavailable();
    }
  };
}

/**
 * A shared daily counter with no per-key window, for a route that takes its slot only after a request has
 * passed validation. Fail closed like the keyed limiter; the counter key is fixed, so no address is involved.
 */
export function createDailyLimiter(
  spec: { prefix: string; max: number },
  deps: { make: (w: MakeSpec) => RatelimitLike | null; now?: () => number; log?: (line: string) => void },
): () => Promise<LimitVerdict> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((line: string) => console.warn(line));
  const limiter = deps.make({ kind: "daily", ...spec });
  const unavailable = (): LimitVerdict => {
    log("[speedrun] limits unavailable");
    return { ok: false, retryAfterMs: UNAVAILABLE_MS };
  };
  return async () => {
    if (!limiter) return unavailable();
    try {
      const result = await limiter.limit("daily");
      if (result.reason === "timeout") return unavailable();
      if (!result.success) return { ok: false, retryAfterMs: Math.max(1, result.reset - now()) };
      return { ok: true, retryAfterMs: 0 };
    } catch {
      return unavailable();
    }
  };
}

/** Never throws: a bad URL or token yields a maker that returns null, which denies every call. */
export function upstashMaker(store: LimitStore | null): (w: MakeSpec) => RatelimitLike | null {
  if (!store) return () => null;
  let redis: Redis;
  try {
    redis = new Redis({ url: store.url, token: store.token, retry: { retries: 1 }, enableTelemetry: false });
  } catch {
    return () => null;
  }
  return (w) => {
    try {
      return new Ratelimit({
        redis,
        limiter: w.kind === "daily" ? Ratelimit.fixedWindow(w.max, "1 d") : Ratelimit.slidingWindow(w.max, w.window),
        prefix: w.prefix,
        timeout: 1000,
        analytics: false,
      });
    } catch {
      return null;
    }
  };
}
