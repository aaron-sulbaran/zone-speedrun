"use client";

import { useEffect, useState } from "react";
import { speedrunCopy } from "@/lib/content";

// A small frosted pill, centered at the bottom of the styled section. It steps
// aside while the join card is on screen, which carries the same line itself, so
// only one copy shows at a time.
export function PinnedAffiliation() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    // The join card carries the line itself. A failed upload re-mounts the join form,
    // so the covered set is re-read whenever #act-2 changes.
    const showing = new Set<Element>();
    let covered: Element[] = [];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) showing.add(entry.target);
        else showing.delete(entry.target);
      }
      setHidden(showing.size > 0);
    });
    const observeCovered = () => {
      const join = document.getElementById("join");
      const next: Element[] = join ? [join] : [];
      if (next.length === covered.length && next.every((el, i) => el === covered[i])) return;
      observer.disconnect();
      showing.clear();
      covered = next;
      covered.forEach((el) => observer.observe(el));
      if (covered.length === 0) setHidden(false);
    };
    observeCovered();
    const section = document.getElementById("act-2");
    const mutations = new MutationObserver(observeCovered);
    if (section) mutations.observe(section, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
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
