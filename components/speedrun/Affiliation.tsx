import { speedrunCopy } from "@/lib/content";
import { PinnedAffiliation } from "./PinnedAffiliation";

// The not-affiliated line: inline beside the demo signup, pinned on the styled section.
export function Affiliation({ variant }: { variant: "inline" | "pinned" }) {
  if (variant === "pinned") return <PinnedAffiliation />;
  return (
    <p data-affiliation="inline" className="font-srcond text-sm text-sr-ink2">
      {speedrunCopy.affiliation}
    </p>
  );
}
