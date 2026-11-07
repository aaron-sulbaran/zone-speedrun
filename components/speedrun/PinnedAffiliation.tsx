"use client";

import { useEffect, useState } from "react";
import { speedrunCopy } from "@/lib/content";

// A small frosted pill, centered at the bottom of the styled section. It steps
// aside while the join card is on screen, which carries the same line itself, so
// only one copy shows at a time.
export function PinnedAffiliation() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const card = document.getElementById("join");
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting));
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return (
    <p
      data-affiliation="pinned"
      aria-hidden={hidden || undefined}
      className={`sticky bottom-3 z-10 mx-auto mb-3 w-fit max-w-[calc(100%-2rem)] rounded-full bg-sr-hud px-4 py-1.5 text-center font-srcond text-[11px] uppercase leading-snug tracking-widest text-sr-ink2 backdrop-blur-[20px] transition-opacity duration-200 ease-sr motion-reduce:transition-none sm:text-xs ${hidden ? "pointer-events-none opacity-0" : ""}`}
    >
      {speedrunCopy.affiliation}
    </p>
  );
}
