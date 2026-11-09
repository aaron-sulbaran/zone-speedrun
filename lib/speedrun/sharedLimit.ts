import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { LimitVerdict } from "./guard";

export type LimitStore = { url: string; token: string };

const PAIRS = [
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
] as const;

/** One whole pair or nothing: a half-set pair never configures the store. */
export function limitStore(env: Record<string, string | undefined>): LimitStore | null {
  for (const [urlName, tokenName] of PAIRS) {
    const url = env[urlName];
    const token = env[tokenName];
    if (url && token) return { url, token };
  }
  return null;
}

export type WindowSpec = { prefix: string; max: number; window: `${number} ${"s" | "m" | "h" | "d"}` };
type DailySpec = { prefix: string; max: number; window: "1 d" };

export type RatelimitLike = {
  limit: (key: string) => Promise<{ success: boolean; reset: number; reason?: string }>;
};

const UNAVAILABLE_MS = 60_000;
const DENIED_UNAVAILABLE: LimitVerdict = { ok: false, retryAfterMs: UNAVAILABLE_MS };

export function createSharedLimiter(
  spec: { perKey: WindowSpec; daily?: { prefix: string; max: number } },
  deps: {
    make: (w: WindowSpec | DailySpec) => RatelimitLike | null;
    now?: () => number;
    log?: (line: string) => void;
  },
): (key: string) => Promise<LimitVerdict> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((line: string) => console.warn(line));
  const perKeyLimiter = deps.make(spec.perKey);
  const dailyLimiter = spec.daily ? deps.make({ ...spec.daily, window: "1 d" }) : undefined;

  const unavailable = (): LimitVerdict => {
    log("[speedrun] limits unavailable");
    return DENIED_UNAVAILABLE;
  };

  return async (key) => {
    if (!perKeyLimiter || (spec.daily && !dailyLimiter)) return unavailable();
    const digest = createHash("sha256").update(key).digest("hex");
    try {
      const steps: [RatelimitLike, string][] = [];
      if (dailyLimiter) steps.push([dailyLimiter, "daily"]);
      steps.push([perKeyLimiter, digest]);
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

export function upstashMaker(store: LimitStore | null): (w: WindowSpec | DailySpec) => RatelimitLike | null {
  if (!store) return () => null;
  const redis = new Redis({ url: store.url, token: store.token });
  return (w) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(w.max, w.window),
      prefix: w.prefix,
      timeout: 1000,
      analytics: false,
    });
}
