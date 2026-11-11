"use client";

import { ArrowLeft } from "lucide-react";
import { forwardRef, type KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import type { FounderRoute as Route } from "@/lib/speedrun/match";
import type { ListItem } from "@/lib/speedrun/matchList";
import { FounderRoute } from "./FounderRoute";
import { MatchCard } from "./MatchCard";

const copy = speedrunCopy.matches;

type MatchDetailProps = {
  item: ListItem | null;
  routes: Route[];
  mentionedFounding: boolean;
  open: boolean;
  onClose: () => void;
};

// Below lg this sits over the list and shows only while open; from lg it is the right column and always shows.
export const MatchDetail = forwardRef<HTMLDivElement, MatchDetailProps>(function MatchDetail({ item, routes, mentionedFounding, open, onClose }, ref) {
  // An Escape the connect sheet already handled is marked defaultPrevented; only an unhandled one closes the detail.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) onClose();
  };
  return (
    <div
      ref={ref}
      data-match-detail=""
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`outline-none overflow-y-auto overscroll-contain bg-sr-bg max-lg:absolute max-lg:inset-0 lg:sticky lg:top-0 lg:h-full lg:min-w-0 lg:flex-1 lg:self-start lg:rounded-2xl lg:border lg:border-sr-soft lg:bg-sr-surface lg:p-5 ${open ? "" : "max-lg:hidden"}`}
    >
      <button
        type="button"
        data-detail-back=""
        onClick={onClose}
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sr-soft px-4 py-2 font-srcond text-xs uppercase tracking-wider text-sr-ink transition-colors duration-200 hover:bg-sr-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none lg:hidden"
      >
        <ArrowLeft aria-hidden="true" size={13} />
        {copy.back}
      </button>
      {item === null ? (
        <p data-detail-empty="" className="rounded-xl border border-sr-soft bg-sr-surface p-6 text-sr-ink2">
          {copy.empty}
        </p>
      ) : item.kind === "founder" ? (
        <FounderRoute routes={routes} mentioned={mentionedFounding} />
      ) : (
        <MatchCard key={item.key} match={item.match} />
      )}
    </div>
  );
});
