import type { MatchResult } from "./match";
import { MAX_PLACES, type UploadErrorKey } from "./demoState";
import type { Intake, Profile } from "./types";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 65_000;

export type ReadResponse =
  | { ok: true; profile: Profile; result: MatchResult }
  | { ok: false; error: UploadErrorKey };

const KNOWN: readonly string[] = ["bad_input", "too_large", "unreadable", "slow_down", "live_off", "bot", "internal"];

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const isText = (file: File) => file.type === "text/plain" || /\.txt$/i.test(file.name);

const MAX_TEXT_CHARS = 20_000;

/** NULs and control characters out, and one past the cap so the server can say "too large". */
export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").slice(0, MAX_TEXT_CHARS + 1);
}

const hasPdfHeader = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-");

type Failure = { ok: false; error: UploadErrorKey };

// The file is read here, in the browser. Only its text is posted, and nothing is kept.
// A failure the browser already knows about is answered here: no request, so no
// BotID check and no rate-limit slot is spent on it.
async function textOf(file: File): Promise<{ text: string } | Failure> {
  if (isText(file)) {
    const text = cleanText(await file.text());
    return text.trim() ? { text } : { ok: false, error: "unreadable" };
  }
  if (!isPdf(file)) return { ok: false, error: "bad_input" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes)) return { ok: false, error: "bad_input" };
  try {
    const { pdfTextInBrowser } = await import("./pdfBrowser");
    const text = cleanText(await pdfTextInBrowser(bytes));
    return text.trim() ? { text } : { ok: false, error: "unreadable" };
  } catch {
    return { ok: false, error: "unreadable" };
  }
}

async function run(file: File, intake: Intake, signal: AbortSignal): Promise<ReadResponse> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "too_large" };
  const read = await textOf(file);
  if ("ok" in read) return read;
  const response = await fetch("/speedrun/api/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: read.text, intake: { ...intake, places: intake.places.slice(0, MAX_PLACES) } }),
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | { profile?: Profile; result?: MatchResult; error?: string }
    | null;
  if (response.ok && body?.profile && body.result) return { ok: true, profile: body.profile, result: body.result };
  const error = body?.error;
  return { ok: false, error: error && KNOWN.includes(error) ? (error as UploadErrorKey) : "network" };
}

// One deadline for the whole wait: reading the file, loading the PDF library,
// BotID's challenge (which never looks at an abort signal) and the response.
export async function postResume(file: File, intake: Intake, deadlineMs = REQUEST_TIMEOUT_MS): Promise<ReadResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<Failure>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, error: "network" });
    }, deadlineMs);
  });
  const attempt = run(file, intake, controller.signal).catch((): Failure => ({ ok: false, error: "network" }));
  try {
    return await Promise.race([attempt, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
