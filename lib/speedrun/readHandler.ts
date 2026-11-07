import type { LanguageModel } from "ai";
import { z } from "zod";
import { readResume, rerank } from "./ai";
import type { LimitVerdict } from "./guard";
import { rankMatches, type MatchResult } from "./match";
import { PdfTooLongError } from "./pdfText";
import { getSnapshot } from "./snapshot";
import { FNS, type Profile } from "./types";

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_CHARS = 20_000;
const MIN_READABLE_CHARS = 40;
const SHOWN = 6;
const RERANK_POOL = 20;

const intakeSchema = z.object({
  targets: z.array(z.enum(FNS)).max(7),
  places: z.array(z.string().max(60)).max(8),
  why: z.string().max(400),
});

export type ReadError = "bad_input" | "too_large" | "unreadable" | "slow_down" | "live_off" | "bot";

export type ReadOutcome =
  | { status: 200; body: { profile: Profile; result: MatchResult; mode: "model" | "rules" } }
  | { status: 400 | 403 | 413 | 422 | 503; body: { error: ReadError } }
  | { status: 429; body: { error: "slow_down"; retryAfterMs: number } };

export type UploadedFile = {
  name: string;
  type: string;
  size: number;
  bytes: () => Promise<Uint8Array>;
};

export type ReadInput = {
  contentLength: number | null;
  form: () => Promise<{ file: UploadedFile | null; text: string | null; intake: string | null }>;
};

export type ReadDeps = {
  live: boolean;
  isBot: () => Promise<boolean>;
  allow: () => LimitVerdict;
  model: LanguageModel | null;
  pdfText: (bytes: Uint8Array) => Promise<string>;
};

const fail = (status: 400 | 403 | 413 | 422 | 503, error: ReadError): ReadOutcome => ({ status, body: { error } });

function isPdf(file: UploadedFile): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isPlainText(file: UploadedFile): boolean {
  return file.type === "text/plain" || /\.txt$/i.test(file.name);
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  // "%PDF" within the first kilobyte, as readers allow.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

async function textFrom(
  file: UploadedFile | null,
  typed: string | null,
  deps: ReadDeps,
): Promise<{ text: string } | ReadOutcome> {
  if (file) {
    if (file.size > MAX_FILE_BYTES) return fail(413, "too_large");
    if (!isPdf(file) && !isPlainText(file)) return fail(400, "bad_input");
    const bytes = await file.bytes();
    if (bytes.byteLength > MAX_FILE_BYTES) return fail(413, "too_large");
    let text: string;
    if (isPdf(file)) {
      if (!hasPdfHeader(bytes)) return fail(400, "bad_input");
      try {
        text = await deps.pdfText(bytes);
      } catch (error) {
        return error instanceof PdfTooLongError ? fail(413, "too_large") : fail(422, "unreadable");
      }
    } else {
      text = new TextDecoder("utf-8").decode(bytes);
    }
    text = text.replace(/\u0000/g, "").trim();
    if (text.length > MAX_TEXT_CHARS) return fail(413, "too_large");
    if (text.length < MIN_READABLE_CHARS) return fail(422, "unreadable");
    return { text };
  }
  if (typed === null) return fail(400, "bad_input");
  const text = typed.trim();
  if (text.length > MAX_TEXT_CHARS) return fail(413, "too_large");
  if (text.length === 0) return fail(400, "bad_input");
  return { text };
}

// Pure: every outside effect (the switch, bot check, limiter, model, PDF reader)
// arrives through `deps`, and the resume text never leaves this function.
export async function handleRead(input: ReadInput, deps: ReadDeps): Promise<ReadOutcome> {
  if (!deps.live) return fail(503, "live_off");
  if (await deps.isBot()) return fail(403, "bot");
  const verdict = deps.allow();
  if (!verdict.ok) return { status: 429, body: { error: "slow_down", retryAfterMs: verdict.retryAfterMs } };
  if (input.contentLength !== null && input.contentLength > MAX_FILE_BYTES + 64 * 1024) {
    return fail(413, "too_large");
  }

  let form: Awaited<ReturnType<ReadInput["form"]>>;
  try {
    form = await input.form();
  } catch {
    return fail(400, "bad_input");
  }

  let rawIntake: unknown;
  try {
    rawIntake = form.intake === null ? null : JSON.parse(form.intake);
  } catch {
    return fail(400, "bad_input");
  }
  const intake = intakeSchema.safeParse(rawIntake);
  if (!intake.success) return fail(400, "bad_input");

  const got = await textFrom(form.file, form.text, deps);
  if ("status" in got) return got;

  const { profile, mode } = await readResume({ text: got.text, intake: intake.data }, { model: deps.model });
  const pool = rankMatches(profile, intake.data, getSnapshot(), deps.model ? RERANK_POOL : SHOWN);
  const reranked = await rerank(profile, pool, { model: deps.model });
  const matches = reranked.matches.slice(0, SHOWN);
  const result: MatchResult = { ...reranked, matches, narrowing: { ...reranked.narrowing, shown: matches.length } };
  return { status: 200, body: { profile, result, mode } };
}
