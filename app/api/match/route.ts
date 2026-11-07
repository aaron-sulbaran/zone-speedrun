import { NextResponse } from "next/server";
import { BodyTooLargeError, createLimiter, readCappedJson } from "@/lib/speedrun/guard";
import { handleMatch } from "@/lib/speedrun/matchHandler";

export const dynamic = "force-dynamic";

// The body is an intake and a person key: a few hundred bytes.
const MAX_BODY_BYTES = 16 * 1024;

const limit = createLimiter({ windowMs: 60_000, max: 30, dailyMax: 20_000 });

function addressOf(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  const verdict = limit(addressOf(request), Date.now());
  if (!verdict.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: verdict.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))) } },
    );
  }
  let body: unknown = null;
  try {
    body = await readCappedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return NextResponse.json({ error: "too_large" }, { status: 413 });
    body = null;
  }
  const outcome = handleMatch(body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
