import { createHash } from "node:crypto";
import { z } from "zod";
import { renderBriefEmail } from "./brief";
import { MAX_ROLE_IDS, sampleBrief } from "./briefSample";
import { BODY_CAPS, BodyTooLargeError, readCappedJson, type LimitVerdict } from "./guard";
import { PEOPLE } from "./people";
import { PERSON_KEYS } from "./types";

const bodySchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  personKey: z.enum(PERSON_KEYS),
  connected: z.boolean(),
  /** The visitor's top matched role ids; unknown ids are dropped when the brief is built. */
  roleIds: z.array(z.string().max(64)).max(MAX_ROLE_IDS),
});

export type BriefError = "email_off" | "bot" | "bad_input" | "too_large" | "slow_down";

/** One answer for every valid submission, so the response never says whether the address is on the list. */
export type BriefOutcome =
  | { status: 202; body: { accepted: true } }
  | { status: 400 | 403 | 413 | 503; body: { error: BriefError } }
  | { status: 429; body: { error: "slow_down"; retryAfterMs: number } };

/** What the delivery step reports, never with an address in it. */
export type DeliveryNote = "not_on_list" | "throttled" | "send_failed";

export type BriefMessage = { to: string; subject: string; html: string; text: string };

export type BriefDeps = {
  live: boolean;
  isBot: () => Promise<boolean>;
  /** Whether the address is on Aaron's list; checked in the delivery step, after the response. */
  allowed: (email: string) => boolean;
  /** Called with a digest of the address, so the limiter never holds the address itself. Carries the daily cap. */
  allow: (key: string) => Promise<LimitVerdict>;
  /** The caller's own address on the network, limited separately from the email address. */
  allowIp: () => Promise<LimitVerdict>;
  send: (message: BriefMessage) => Promise<boolean>;
  /** One line per failure kind; the route writes it to the log with no address. */
  note?: (kind: DeliveryNote) => void;
};

export type BriefResult = {
  outcome: BriefOutcome;
  /** Runs after the response (the route hands it to `after()`); null when nothing is to be delivered. Never throws. */
  deliver: (() => Promise<void>) | null;
};

const fail = (status: 400 | 403 | 413 | 503, error: BriefError): BriefResult => ({
  outcome: { status, body: { error } },
  deliver: null,
});

// Pure: the switch, bot check, limiters and sender all arrive through `deps`.
// The email is built from a sample person only, so no visitor text is ever in it.
export async function handleBrief(body: unknown, deps: BriefDeps): Promise<BriefResult> {
  if (!deps.live) return fail(503, "email_off");
  if (await deps.isBot()) return fail(403, "bot");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "bad_input");
  const { email, personKey, connected, roleIds } = parsed.data;

  // A 429 here depends on the caller only, never on the address.
  const ipVerdict = await deps.allowIp();
  if (!ipVerdict.ok) return { outcome: { status: 429, body: { error: "slow_down", retryAfterMs: ipVerdict.retryAfterMs } }, deliver: null };

  const note = deps.note ?? (() => {});
  const deliver = async () => {
    try {
      if (!deps.allowed(email)) return note("not_on_list");
      const digest = createHash("sha256").update(email.toLowerCase()).digest("hex");
      const verdict = await deps.allow(digest);
      if (!verdict.ok) return note("throttled");
      const rendered = renderBriefEmail(sampleBrief(personKey, { connected, roleIds }), PEOPLE[personKey].profile.firstName);
      const sent = await deps.send({ to: email, subject: rendered.subject, html: rendered.html, text: rendered.text });
      if (!sent) note("send_failed");
    } catch {
      note("send_failed");
    }
  };
  return { outcome: { status: 202, body: { accepted: true } }, deliver };
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

/** The guard's capped reader, mapped to the brief route's two outcomes: too big, or a body the schema will refuse. */
export async function readBriefBody(request: Request): Promise<{ body: unknown } | { tooLarge: true }> {
  try {
    return { body: await readCappedJson(request, BODY_CAPS.brief) };
  } catch (error) {
    return error instanceof BodyTooLargeError ? { tooLarge: true } : { body: null };
  }
}
