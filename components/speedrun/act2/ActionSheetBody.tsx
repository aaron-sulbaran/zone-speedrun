import type { SheetContent } from "@/lib/speedrun/actions";

type Ui = { drafted: string; slots: string; pickSlot: string; prep: string; meeting: string; meetingLink: string; close: string };

const LABEL = "font-srcond text-sm uppercase tracking-widest text-sr-ink2";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

/** What the sheet shows, from the Action's own content: a draft, the slots, the prep, or the call, always as plain text. */
export function ActionSheetBody({ sheet, ui, onConfirm, onClose }: { sheet: SheetContent; ui: Ui; onConfirm: (picked?: string) => void; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 id="sr-sheet-title" className="text-xl font-semibold leading-tight">
        {sheet.title}
      </h2>
      {sheet.summary && <p data-sheet-summary="" className="text-base text-sr-ink">{sheet.summary}</p>}
      {sheet.draft && (
        <section>
          <p className={LABEL}>{ui.drafted}</p>
          <p data-sheet-draft="" className="mt-2 rounded-xl bg-sr-hud px-4 py-3 text-base text-sr-ink">{sheet.draft}</p>
        </section>
      )}
      {sheet.slots && (
        <section>
          <p className={LABEL}>{sheet.pickSlot ? ui.pickSlot : ui.slots}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {sheet.slots.map((slot) => (
              <li key={slot}>
                {sheet.pickSlot ? (
                  <button type="button" data-sheet-slot="" onClick={() => onConfirm(slot)} className={`min-h-11 w-full rounded-xl bg-sr-hud px-4 py-3 text-left text-base font-semibold hover:bg-sr-strong ${FOCUS}`}>{slot}</button>
                ) : (
                  <span data-sheet-slot="" className="block rounded-xl bg-sr-hud px-4 py-3 text-base">{slot}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {sheet.meeting && (
        <section>
          <p className={LABEL}>{ui.meeting}</p>
          <p data-sheet-meeting="" className="mt-2 text-base">{sheet.meeting.when}</p>
          <p className="mt-1 text-sm text-sr-ink2">
            {ui.meetingLink}: <span data-sheet-meeting-link="">{sheet.meeting.link}</span>
          </p>
        </section>
      )}
      {sheet.prep && (
        <section>
          <p className={LABEL}>{ui.prep}</p>
          <ul className="mt-2 list-disc pl-5 text-base">
            {sheet.prep.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {sheet.links && (
        <ul className="flex flex-wrap gap-2">
          {sheet.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center rounded-full bg-sr-hud px-4 text-sm font-semibold text-sr-ink hover:bg-sr-strong ${FOCUS}`}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p data-sheet-note="" className="text-sm text-sr-ink2">{sheet.note}</p>
      <div className="flex flex-wrap items-center gap-3">
        {!sheet.pickSlot && (
          <button type="button" data-sheet-confirm="" onClick={() => onConfirm()} className={`min-h-11 min-w-11 rounded-full bg-sr-ink px-6 font-srcond text-sm uppercase tracking-wider text-sr-surface ${FOCUS}`}>
            {sheet.confirm}
          </button>
        )}
        <button type="button" data-sheet-close="" onClick={onClose} className={`min-h-11 min-w-11 rounded-full px-4 text-sm font-semibold text-sr-ink2 hover:text-sr-ink ${FOCUS}`}>
          {ui.close}
        </button>
      </div>
    </div>
  );
}
