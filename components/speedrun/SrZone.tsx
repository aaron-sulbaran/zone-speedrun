"use client";

import { useEffect } from "react";

// Sets <html data-sr-zone> while a phase of the styled section is on screen, so
// the site's fixed top fade can wear the paper color there (app/globals.css).
// Removed when inactive or on leave, so no other page is touched.
export function SrZone({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.setAttribute("data-sr-zone", "");
    return () => root.removeAttribute("data-sr-zone");
  }, [active]);
  return null;
}
