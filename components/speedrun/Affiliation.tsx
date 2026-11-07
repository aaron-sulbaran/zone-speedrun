import { speedrunCopy } from "@/lib/content";

// The not-affiliated line: inline beside the demo signup, pinned on the styled section.
export function Affiliation({ variant }: { variant: "inline" | "pinned" }) {
  const base = "font-srcond text-sm text-sr-ink2";
  const placement = variant === "pinned" ? "sticky bottom-0 z-10 bg-sr-hud px-6 py-3 text-center" : "";
  return (
    <p data-affiliation={variant} className={`${base} ${placement}`.trim()}>
      {speedrunCopy.affiliation}
    </p>
  );
}
