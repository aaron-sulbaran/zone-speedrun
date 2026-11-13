import { speedrunCopy } from "@/lib/content";
import type { PassedBy } from "@/lib/speedrun/introRequest";

// Whose view is this: the chip beside the actions (Ruling 75). It flips to the founder when Task 5's panel opens.
export function ActingAs({ who, nowrap = false }: { who: PassedBy; nowrap?: boolean }) {
  return (
    <p data-acting-as="" className={`inline-block max-w-full rounded-full bg-sr-hud px-3 py-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2${nowrap ? " whitespace-nowrap" : ""}`}>
      {speedrunCopy.team.actingAs[who]}
    </p>
  );
}
