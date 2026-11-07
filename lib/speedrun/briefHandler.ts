import { createHash } from "node:crypto";
import { z } from "zod";
import { renderBriefEmail } from "./brief";
import { MAX_ROLE_IDS, sampleBrief } from "./briefSample";
import type { LimitVerdict } from "./guard";
import { PEOPLE } from "./people";
import { PERSON_KEYS } from "./types";

const bodySchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  personKey: z.enum(PERSON_KEYS),
  connected: z.boolean(),
  /** The visitor's top matched role ids; unknown ids are dropped when the brief is built. */
  roleIds: z.array(z.string().max(64)).max(MAX_ROLE_IDS),
});

export type BriefError = "email_off" | "bot" | "bad_input" | "too_large" | "slow_down" | "send_failed";

export type BriefOutcome =
  | { status: 200; body: { sent: true } }
  | { status: 400 | 403 | 413 | 502 | 503; body: { error: BriefError } }
  | { status: 429; body: { error: "slow_down"; retryAfterMs: number } };

export type BriefMessage = { to: string; subject: string; html: string; text: string };

export type BriefDeps = {
  live: boolean;
  isBot: () => Promise<boolean>;
  /** Called with a digest of the address, so the limiter never holds the address itself. */
  allow: (key: string) => LimitVerdict;
  /** The caller's own address on the network, limited separately from the email address. */
  allowIp: () => LimitVerdict;
  send: (message: BriefMessage) => Promise<boolean>;
};

const fail = (status: 400 | 403 | 413 | 502 | 503, error: BriefError): BriefOutcome => ({ status, body: { error } });

// Pure: the switch, bot check, limiter and sender all arrive through `deps`.
// The email is built from a sample person only, so no visitor text is ever in it.
export async function handleBrief(body: unknown, deps: BriefDeps): Promise<BriefOutcome> {
  if (!deps.live) return fail(503, "email_off");
  if (await deps.isBot()) return fail(403, "bot");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "bad_input");
  const { email, personKey, connected, roleIds } = parsed.data;

  const ipVerdict = deps.allowIp();
  if (!ipVerdict.ok) return { status: 429, body: { error: "slow_down", retryAfterMs: ipVerdict.retryAfterMs } };

  const digest = createHash("sha256").update(email.toLowerCase()).digest("hex");
  const verdict = deps.allow(digest);
  if (!verdict.ok) return { status: 429, body: { error: "slow_down", retryAfterMs: verdict.retryAfterMs } };

  const rendered = renderBriefEmail(sampleBrief(personKey, { connected, roleIds }), PEOPLE[personKey].profile.firstName);
  const sent = await deps.send({ to: email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  return sent ? { status: 200, body: { sent: true } } : fail(502, "send_failed");
}

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

/** Resend's plain HTTP API. Nothing from the response is kept or logged, since errors can echo the address. */
export async function sendWithResend(
  message: BriefMessage,
  env: { apiKey: string; from: string },
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const MAX_BODY_BYTES = 1024;

/** Reads at most MAX_BODY_BYTES, so a missing content-length cannot make the server buffer a huge body. */
export async function readCappedJson(request: Request): Promise<{ body: unknown } | { tooLarge: true }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { tooLarge: true };
  const reader = request.body?.getReader();
  if (!reader) return { body: null };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { body: null };
  }
}
