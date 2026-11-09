import { after, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { handleBrief, readBriefBody, sendWithResend } from "@/lib/speedrun/briefHandler";
import { liveFlags } from "@/lib/speedrun/guard";
import { limitStore } from "@/lib/speedrun/limitStore";
import { isAllowed, parseAllowlist } from "@/lib/speedrun/recipients";
import { createSharedLimiter, upstashMaker } from "@/lib/speedrun/sharedLimit";

export const dynamic = "force-dynamic";

// 3 sends an hour per address and 3 an hour per caller; 50 a day across the fleet,
// carried by the address limiter, which is checked last, so only a request that passed both windows counts.
const make = upstashMaker(limitStore(process.env));
const limit = createSharedLimiter(
  { perKey: { prefix: "speedrun:brief:to", max: 3, window: "1 h" }, daily: { prefix: "speedrun:brief:daily", max: 50 } },
  { make },
);
const ipLimit = createSharedLimiter({ perKey: { prefix: "speedrun:brief:ip", max: 3, window: "1 h" } }, { make });

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
  const { outcome, deliver } = await handleBrief(body, {
    live,
    // BotID only means something on Vercel; local runs and tests skip it.
    isBot: async () => (process.env.VERCEL === "1" ? (await checkBotId()).isBot : false),
    allowed: (email) => isAllowed(email, parseAllowlist(process.env.SPEEDRUN_BRIEF_ALLOW)),
    allow: (key) => limit(key),
    allowIp: () => ipLimit(addressOf(request)),
    send: (message) =>
      sendWithResend(message, { apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.SPEEDRUN_EMAIL_FROM ?? "" }),
    note: (kind) => {
      // Probes of the list are expected, so they stay out of the error log.
      if (kind === "not_on_list") console.info("[speedrun] brief skipped: not_on_list");
      else console.error(`[speedrun] brief failed: ${kind}`);
    },
  });
  // The list check, the address limiter and the send run after the response, so the answer is the same for every address.
  if (deliver) after(deliver);
  if (outcome.status === 429) {
    const seconds = Math.max(1, Math.ceil(outcome.body.retryAfterMs / 1000));
    return NextResponse.json(outcome.body, { status: 429, headers: { "Retry-After": String(seconds) } });
  }
  if ("error" in outcome.body) console.error(`[speedrun] brief failed: ${outcome.body.error}`);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
