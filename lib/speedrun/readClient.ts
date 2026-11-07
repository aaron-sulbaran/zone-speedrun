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

// The file is read here, in the browser. Only its text is posted, and nothing is kept.
async function textOf(file: File): Promise<{ text: string; unreadable: boolean } | "bad_input"> {
  if (isText(file)) return { text: await file.text(), unreadable: false };
  if (!isPdf(file)) return "bad_input";
  try {
    const { pdfTextInBrowser } = await import("./pdfBrowser");
    const text = await pdfTextInBrowser(new Uint8Array(await file.arrayBuffer()));
    return { text, unreadable: text.trim().length === 0 };
  } catch {
    return { text: "", unreadable: true };
  }
}

export async function postResume(file: File, intake: Intake): Promise<ReadResponse> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "too_large" };
  const read = await textOf(file).catch(() => "bad_input" as const);
  if (read === "bad_input") return { ok: false, error: "bad_input" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/speedrun/api/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: read.text,
        unreadable: read.unreadable,
        intake: { ...intake, places: intake.places.slice(0, MAX_PLACES) },
      }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as
      | { profile?: Profile; result?: MatchResult; error?: string }
      | null;
    if (response.ok && body?.profile && body.result) return { ok: true, profile: body.profile, result: body.result };
    const error = body?.error;
    return { ok: false, error: error && KNOWN.includes(error) ? (error as UploadErrorKey) : "network" };
  } catch {
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}
