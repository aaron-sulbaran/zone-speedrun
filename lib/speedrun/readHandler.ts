import type { LanguageModel } from "ai";
import { z } from "zod";
import { RERANK_POOL, readResume, rerank } from "./ai";
import { BODY_CAPS, BodyTooLargeError, type LimitVerdict } from "./guard";
import { effectiveProfile, rankMatches, type MatchResult } from "./match";
import { getSnapshot } from "./snapshot";
import { FNS, type Profile, type ReadError } from "./types";

// The browser reads the file (PDF text included); this route only ever sees text.
export const MAX_TEXT_CHARS = 20_000;
const SHOWN = 6;

export const readBodySchema = z.object({
  text: z.string(),
  intake: z.object({
    targets: z.array(z.enum(FNS)).max(7),
    places: z.array(z.string().max(60)).max(8),
    why: z.string().max(400),
    seniority: z.enum(["intern", "new_grad"]).optional(),
    founding: z.boolean().optional(),
  }),
});

export { BodyTooLargeError };

export type { ReadError };

export type ReadOutcome =
  | { status: 200; body: { profile: Profile; result: MatchResult; mode: "model" | "rules" } }
  | { status: 400 | 403 | 413 | 422 | 500 | 503; body: { error: ReadError } }
  | { status: 429; body: { error: "slow_down"; retryAfterMs: number } };

export type ReadInput = {
  contentLength: number | null;
  /** Parsed JSON; throws BodyTooLargeError past the byte cap, anything else means bad JSON. */
  json: () => Promise<unknown>;
};

export type ReadDeps = {
  live: boolean;
  isBot: () => Promise<boolean>;
  allow: () => Promise<LimitVerdict>;
  model: LanguageModel | null;
};

const fail = (status: 400 | 403 | 413 | 422 | 503, error: ReadError): ReadOutcome => ({ status, body: { error } });

// Pure: every outside effect (the switch, bot check, limiter, model) arrives
// through `deps`, and the resume text never leaves this function.
export async function handleRead(input: ReadInput, deps: ReadDeps): Promise<ReadOutcome> {
  if (!deps.live) return fail(503, "live_off");
  if (await deps.isBot()) return fail(403, "bot");
  const verdict = await deps.allow();
  if (!verdict.ok) return { status: 429, body: { error: "slow_down", retryAfterMs: verdict.retryAfterMs } };
  if (input.contentLength !== null && input.contentLength > BODY_CAPS.read) return fail(413, "too_large");

  let raw: unknown;
  try {
    raw = await input.json();
  } catch (error) {
    return error instanceof BodyTooLargeError ? fail(413, "too_large") : fail(400, "bad_input");
  }
  const body = readBodySchema.safeParse(raw);
  if (!body.success) return fail(400, "bad_input");
  const { intake } = body.data;
  const text = body.data.text.replace(/\u0000/g, "").trim();
  if (text.length > MAX_TEXT_CHARS) return fail(413, "too_large");
  if (text.length === 0) return fail(422, "unreadable");

  const { profile, mode } = await readResume({ text, intake }, { model: deps.model });
  // A model that already failed once is not asked a second time.
  const rerankModel = mode === "model" ? deps.model : null;
  const pool = rankMatches(profile, intake, getSnapshot(), rerankModel ? RERANK_POOL : SHOWN);
  const reranked = await rerank(effectiveProfile(profile, intake), pool, { model: rerankModel });
  const matches = reranked.matches.slice(0, SHOWN);
  const result: MatchResult = { ...reranked, matches, narrowing: { ...reranked.narrowing, shown: matches.length } };
  return { status: 200, body: { profile, result, mode } };
}
