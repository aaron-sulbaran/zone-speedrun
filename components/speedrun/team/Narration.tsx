// One line for the current beat, in the build log's terminal look but without typing (Ruling 75).
// The status element stays mounted, so a changed line is announced politely, and it holds only the line. The prompt is an aria-hidden span, so a screen reader never reads it out.
export const NARRATION_LOOK = "rounded-xl bg-sr-term px-4 py-3 font-mono text-[13px] leading-relaxed text-sr-surface sm:text-sm";

/** The panels' copies are aria-hidden as a whole, so their prompt can stay generated content. */
export const PANEL_PROMPT = "before:text-sr-aqua before:content-['>_']";

/** The terminal prompt, drawn but never read out. */
export function Prompt() {
  return (
    <span aria-hidden="true" className="text-sr-aqua">
      {"> "}
    </span>
  );
}

export function Narration({ line }: { line: string }) {
  return (
    <div className={NARRATION_LOOK}>
      <Prompt />
      <span role="status" aria-live="polite" data-narration="">
        {line}
      </span>
    </div>
  );
}
