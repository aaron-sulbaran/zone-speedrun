// One line for the current beat, in the build log's terminal look but without typing (Ruling 75).
// The status element stays mounted, so a changed line is announced politely. The prompt is a pseudo-element, so it is never read out.
export function Narration({ line }: { line: string }) {
  return (
    <div role="status" aria-live="polite" data-narration="" className="rounded-xl bg-sr-term px-4 py-3 font-mono text-[13px] leading-relaxed text-sr-surface before:text-sr-aqua before:content-['>_'] sm:text-sm">
      {line}
    </div>
  );
}
