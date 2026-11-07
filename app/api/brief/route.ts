import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { handleBrief, readBriefBody, sendWithResend } from "@/lib/speedrun/briefHandler";
import { createLimiter, liveFlags } from "@/lib/speedrun/guard";

export const dynamic = "force-dynamic";

// 3 sends an hour per address, 50 a day per instance; and 3 an hour per caller.
const limit = createLimiter({ windowMs: 60 * 60 * 1000, max: 3, dailyMax: 50 });
const ipLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 3, dailyMax: 50 });

function addressOf(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

// The address lives in this request only: it is not stored, and it is never logged.
export async function POST(request: Request) {
  const live = liveFlags().email;
  // With the switch off nothing is read from the request at all.
  let body: unknown = null;
  if (live) {
    const read = await readBriefBody(request);
    if ("tooLarge" in read) {
      console.error("[speedrun] brief failed: too_large");
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    body = read.body;
  }
  const outcome = await handleBrief(body, {
    live,
    // BotID only means something on Vercel; local runs and tests skip it.
    isBot: async () => (process.env.VERCEL === "1" ? (await checkBotId()).isBot : false),
    allow: (key) => limit(key, Date.now()),
    allowIp: () => ipLimit(addressOf(request), Date.now()),
    send: (message) =>
      sendWithResend(message, { apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.SPEEDRUN_EMAIL_FROM ?? "" }),
  });
  if (outcome.status === 429) {
    const seconds = Math.max(1, Math.ceil(outcome.body.retryAfterMs / 1000));
    return NextResponse.json(outcome.body, { status: 429, headers: { "Retry-After": String(seconds) } });
  }
  if (outcome.status !== 200) console.error(`[speedrun] brief failed: ${outcome.body.error}`);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
