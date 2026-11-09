import { limitStore } from "./sharedLimit";

// The live-reading switches and a small limiter. Both are pure: the limiter
// takes the clock as an argument and keeps only counters in memory.

export type LimitVerdict = { ok: boolean; retryAfterMs: number };

type LimiterOptions = { windowMs: number; max: number; dailyMax: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

const SWEEP_EVERY_MS = 60_000;

export type Limiter = ((key: string, now: number) => LimitVerdict) & { size: () => number };

export function createLimiter(opts: LimiterOptions): Limiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  const daily = { count: 0, resetAt: 0 };
  let nextSweepAt = 0;

  // Keys are raw addresses or digests of them: drop each one as its window ends, not only when it returns.
  const sweep = (now: number) => {
    for (const [key, entry] of windows) if (now >= entry.resetAt) windows.delete(key);
    nextSweepAt = now + SWEEP_EVERY_MS;
  };

  const limit = (key: string, now: number): LimitVerdict => {
    if (now >= nextSweepAt) sweep(now);
    if (now >= daily.resetAt) {
      daily.count = 0;
      daily.resetAt = now + DAY_MS;
    }
    if (daily.count >= opts.dailyMax) {
      return { ok: false, retryAfterMs: Math.max(1, daily.resetAt - now) };
    }

    const entry = windows.get(key);
    if (!entry || now >= entry.resetAt) {
      if (windows.size >= MAX_TRACKED_KEYS) {
        sweep(now);
        // Still full of live windows: forget the oldest one, never everyone at once.
        if (windows.size >= MAX_TRACKED_KEYS) windows.delete(windows.keys().next().value as string);
      }
      windows.set(key, { count: 1, resetAt: now + opts.windowMs });
      daily.count += 1;
      return { ok: true, retryAfterMs: 0 };
    }
    if (entry.count >= opts.max) {
      return { ok: false, retryAfterMs: Math.max(1, entry.resetAt - now) };
    }
    entry.count += 1;
    daily.count += 1;
    return { ok: true, retryAfterMs: 0 };
  };
  return Object.assign(limit, { size: () => windows.size });
}

/** Each route's body cap in bytes, in one place. */
export const BODY_CAPS = {
  /** An intake and a person key: a few hundred bytes. */
  match: 16 * 1024,
  /** Resume text up to 20,000 characters, with room for escapes. */
  read: 96 * 1024,
  /** An address, a person key and a few role ids. */
  brief: 1024,
} as const;

export class BodyTooLargeError extends Error {}

/** Reads at most `max` bytes, so a missing content-length cannot make the server buffer a huge body. */
export async function readCappedJson(request: Request, max: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new BodyTooLargeError("too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("no body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new BodyTooLargeError("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Explicit switches, never key presence: on Vercel the AI Gateway signs in with
// an automatic OIDC token, so a key check alone would turn spend on. A switch
// also needs the shared limit store; without it the feature stays off.

// Placeholder until the allowlist parser lands: no entries, so email stays off.
const parseAllowlist = (raw: string | undefined): string[] => (raw ? [] : []);

const loggedGaps = new Set<string>();
function logGap(feature: string, piece: "store" | "allowlist") {
  const id = `${feature}:${piece}`;
  if (loggedGaps.has(id)) return;
  loggedGaps.add(id);
  console.warn(`[speedrun] ${feature} switch is on but the ${piece} is missing, so it stays off`);
}

export function liveFlags(env: Record<string, string | undefined> = process.env): { reading: boolean; email: boolean } {
  const hasStore = limitStore(env) !== null;
  const readingSwitch = env.SPEEDRUN_AI === "on";
  const emailSwitch = env.SPEEDRUN_EMAIL === "on" && Boolean(env.RESEND_API_KEY) && Boolean(env.SPEEDRUN_EMAIL_FROM);
  const hasAllowlist = parseAllowlist(env.SPEEDRUN_BRIEF_ALLOW).length > 0;
  if (readingSwitch && !hasStore) logGap("reading", "store");
  if (emailSwitch && !hasStore) logGap("email", "store");
  if (emailSwitch && !hasAllowlist) logGap("email", "allowlist");
  return { reading: readingSwitch && hasStore, email: emailSwitch && hasStore && hasAllowlist };
}
