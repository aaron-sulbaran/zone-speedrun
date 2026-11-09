import { speedrunCopy } from "@/lib/content";

const GHOST = "rounded-full px-4 py-2 font-srcond text-xs uppercase tracking-wider text-sr-ink2 underline-offset-4 hover:text-sr-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

// Holds the screen while the sample or the upload is being built. The heading above
// already says what is happening, so waiting shows only a quiet way out (a résumé
// read can take a minute); a failure offers a retry and the same way out.
export function BuildPlaceholder({ failed, onRetry, onStartOver }: { failed: boolean; onRetry: () => void; onStartOver: () => void }) {
  const copy = speedrunCopy.join;
  if (!failed) {
    return (
      <div className="mx-auto flex max-w-2xl justify-center">
        <button type="button" onClick={onStartOver} className={GHOST}>
          {copy.startOver}
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-sr-surface px-8 py-10 text-center shadow-[0_16px_56px_var(--sr-soft)]">
      <p role="alert" className="text-lg font-semibold">{copy.error}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onRetry} className="rounded-full bg-sr-hud px-5 py-2 font-srcond text-sm uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple">
          {copy.retry}
        </button>
        <button type="button" onClick={onStartOver} className={GHOST}>
          {copy.startOver}
        </button>
      </div>
    </div>
  );
}
