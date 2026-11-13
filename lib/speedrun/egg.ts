// Triggers for the Act 2 Easter egg: a typed word and a burst of logo clicks.
// Off until Aaron's meme lands: while false neither trigger is wired and the dialog never mounts.
export const EGG_ENABLED = false;
export const EGG_WORD = "sux";
export const EGG_CLICKS = 5;
export const EGG_CLICK_WINDOW_MS = 2000;

/** Slides a key into the buffer; reports a match when the buffer ends with the word. */
export function pushKey(buffer: string, key: string, word: string = EGG_WORD): { buffer: string; matched: boolean } {
  // Only single printable characters count; Shift, Tab and friends leave the buffer alone.
  if (key.length !== 1) return { buffer, matched: false };
  const next = (buffer + key.toLowerCase()).slice(-word.length);
  return next === word ? { buffer: "", matched: true } : { buffer: next, matched: false };
}

/** Keeps the times of recent clicks; reports a match at the count inside the window. */
export function pushClick(
  times: number[],
  now: number,
  count: number = EGG_CLICKS,
  windowMs: number = EGG_CLICK_WINDOW_MS,
): { times: number[]; matched: boolean } {
  const recent = [...times, now].filter((time) => now - time <= windowMs).slice(-count);
  return recent.length >= count ? { times: [], matched: true } : { times: recent, matched: false };
}

/** True when typing belongs to a field, so the egg stays quiet. */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
