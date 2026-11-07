// The live-reading switches and a small limiter. Both are pure: the limiter
// takes the clock as an argument and keeps only counters in memory.

export type LimitVerdict = { ok: boolean; retryAfterMs: number };

type LimiterOptions = { windowMs: number; max: number; dailyMax: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

export function createLimiter(opts: LimiterOptions): (key: string, now: number) => LimitVerdict {
  const windows = new Map<string, { count: number; resetAt: number }>();
  const daily = { count: 0, resetAt: 0 };

  return (key, now) => {
    if (now >= daily.resetAt) {
      daily.count = 0;
      daily.resetAt = now + DAY_MS;
    }
    if (daily.count >= opts.dailyMax) {
      return { ok: false, retryAfterMs: Math.max(1, daily.resetAt - now) };
    }

    const entry = windows.get(key);
    if (!entry || now >= entry.resetAt) {
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
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
}

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
// an automatic OIDC token, so a key check alone would turn spend on.
export function liveFlags(): { reading: boolean; email: boolean } {
  return {
    reading: process.env.SPEEDRUN_AI === "on",
    email:
      process.env.SPEEDRUN_EMAIL === "on" &&
      Boolean(process.env.RESEND_API_KEY) &&
      Boolean(process.env.SPEEDRUN_EMAIL_FROM),
  };
}
