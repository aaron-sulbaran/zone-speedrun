import type { ReactNode } from "react";

/** One of the Board's lower sections: a card with its heading. */
export function BoardSection({ id, heading, children }: { id: "today" | "intros" | "shortlist" | "tools"; heading: string; children: ReactNode }) {
  return (
    <section data-board-section={id} aria-labelledby={`sr-section-${id}`} className="rounded-2xl border border-sr-soft bg-sr-surface p-5 md:p-6">
      <h4 id={`sr-section-${id}`} tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink2 focus:outline-none">
        {heading}
      </h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}
