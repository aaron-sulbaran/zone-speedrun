import { NextResponse } from "next/server";
import { createWindowLimiter, handleMatch } from "@/lib/speedrun/matchHandler";

export const dynamic = "force-dynamic";

const limiter = createWindowLimiter(30, 60_000);

function addressOf(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  if (!limiter.allow(addressOf(request), Date.now())) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const outcome = handleMatch(body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
