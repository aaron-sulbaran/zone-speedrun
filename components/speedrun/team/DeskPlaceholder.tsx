import { speedrunCopy } from "@/lib/content";

// Heading only. The talent team's desk replaces this.
export function DeskPlaceholder() {
  return (
    <section data-desk="" className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6 short-landscape:overflow-visible lg:px-2">
      <h2 tabIndex={-1} className="font-srcond text-sm uppercase tracking-widest text-sr-ink focus:outline-none">
        {speedrunCopy.team.heading}
      </h2>
    </section>
  );
}
