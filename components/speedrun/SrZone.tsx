"use client";

import { useEffect } from "react";

const FADE_PX = 72;

// Sets <html data-sr-zone> while the styled section is under the top of the
// viewport, so the site's fixed top fade can wear the paper color there
// (app/globals.css). Removed on leave, so no other page is touched.
export function SrZone({ targetId }: { targetId: string }) {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = document.getElementById(targetId)?.getBoundingClientRect();
      const inside = !!box && box.top < FADE_PX && box.bottom > 0;
      if (inside) root.setAttribute("data-sr-zone", "");
      else root.removeAttribute("data-sr-zone");
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    soon();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      root.removeAttribute("data-sr-zone");
    };
  }, [targetId]);
  return null;
}
