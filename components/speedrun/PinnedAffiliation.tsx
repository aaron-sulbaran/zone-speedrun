"use client";

import { useEffect, useState } from "react";
import { speedrunCopy } from "@/lib/content";

// A small frosted pill, centered at the bottom of the styled section. It steps
// aside while the join card is on screen, which carries the same line itself, so
// only one copy shows at a time.
export function PinnedAffiliation() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    // The join card and the close both carry the line themselves.
    const covered = [document.getElementById("join"), document.querySelector("[data-close]")].filter((el): el is Element => el !== null);
    if (covered.length === 0) return;
    const showing = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) showing.add(entry.target);
        else showing.delete(entry.target);
      }
      setHidden(showing.size > 0);
    });
    covered.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  // The wrapper has no height, so the pill reserves no space at the end of the page.
  return (
    <div className="sticky bottom-0 z-10 h-0">
      <p
        data-affiliation="pinned"
        aria-hidden={hidden || undefined}
        className={`absolute bottom-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-sr-hud px-4 py-1.5 text-center font-srcond text-[11px] uppercase leading-snug tracking-widest text-sr-ink2 backdrop-blur-[20px] transition-opacity duration-200 ease-sr motion-reduce:transition-none sm:text-xs ${hidden ? "pointer-events-none opacity-0" : ""}`}
      >
        {speedrunCopy.affiliation}
      </p>
    </div>
  );
}
