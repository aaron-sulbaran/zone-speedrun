import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { liveModel } from "@/lib/speedrun/ai";
import { BODY_CAPS, liveFlags, readCappedJson } from "@/lib/speedrun/guard";
import { handleRead } from "@/lib/speedrun/readHandler";
import { createSharedLimiter, limitStore, upstashMaker } from "@/lib/speedrun/sharedLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 5 reads per 10 minutes per address, 300 a day across the fleet; no store means every read is refused.
const limit = createSharedLimiter(
  { perKey: { prefix: "speedrun:read", max: 5, window: "10 m" }, daily: { prefix: "speedrun:read:daily", max: 300 } },
  { make: upstashMaker(limitStore(process.env)) },
);

function addressOf(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

// The resume text lives in this request only: no Blob, database, disk or log.
// The browser has already turned a PDF into text, so no file is parsed here.
export async function POST(request: Request) {
  try {
    const live = liveFlags().reading;
    const length = Number(request.headers.get("content-length"));
    const outcome = await handleRead(
      {
        contentLength: Number.isFinite(length) && length > 0 ? length : null,
        json: () => readCappedJson(request, BODY_CAPS.read),
      },
      {
        live,
        // BotID only means something on Vercel; local runs and tests skip it.
        isBot: async () => (process.env.VERCEL === "1" ? (await checkBotId()).isBot : false),
        allow: () => limit(addressOf(request)),
        model: live ? liveModel() : null,
      },
    );
    if (outcome.status === 429) {
      const seconds = Math.max(1, Math.ceil(outcome.body.retryAfterMs / 1000));
      return NextResponse.json(outcome.body, { status: 429, headers: { "Retry-After": String(seconds) } });
    }
    if (outcome.status !== 200) console.error(`[speedrun] read failed: ${outcome.body.error}`);
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch {
    console.error("[speedrun] read failed: internal");
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
