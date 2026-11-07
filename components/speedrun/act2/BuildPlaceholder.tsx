import { speedrunCopy } from "@/lib/content";

// Holds the screen while the sample or the upload is being built.
export function BuildPlaceholder({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const copy = speedrunCopy.join;
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-sr-surface px-8 py-10 text-center shadow-[0_16px_56px_var(--sr-soft)]">
      {failed ? (
        <>
          <p className="text-lg font-semibold">{copy.error}</p>
          <button type="button" onClick={onRetry} className="mt-4 rounded-full bg-sr-hud px-5 py-2 font-srcond text-sm uppercase tracking-wider">
            {copy.retry}
          </button>
        </>
      ) : (
        <p role="status" className="text-lg font-semibold">
          {copy.building}
        </p>
      )}
    </div>
  );
}
