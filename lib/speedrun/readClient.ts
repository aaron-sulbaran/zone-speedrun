import type { MatchResult } from "./match";
import { MAX_PLACES } from "./demoState";
import type { Intake, Profile } from "./types";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadErrorKey = "bad_input" | "too_large" | "unreadable" | "slow_down" | "live_off" | "bot" | "network";
export type ReadResponse =
  | { ok: true; profile: Profile; result: MatchResult }
  | { ok: false; error: UploadErrorKey };

const KNOWN: readonly string[] = ["bad_input", "too_large", "unreadable", "slow_down", "live_off", "bot"];

// The file goes straight to the read route and is kept nowhere on the client.
export async function postResume(file: File, intake: Intake, signal?: AbortSignal): Promise<ReadResponse> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "too_large" };
  const form = new FormData();
  form.set("file", file);
  form.set("intake", JSON.stringify({ ...intake, places: intake.places.slice(0, MAX_PLACES) }));
  try {
    const response = await fetch("/speedrun/api/read", { method: "POST", body: form, signal });
    const body = (await response.json().catch(() => null)) as
      | { profile?: Profile; result?: MatchResult; error?: string }
      | null;
    if (response.ok && body?.profile && body.result) return { ok: true, profile: body.profile, result: body.result };
    const error = body?.error;
    return { ok: false, error: error && KNOWN.includes(error) ? (error as UploadErrorKey) : "network" };
  } catch {
    return { ok: false, error: "network" };
  }
}
