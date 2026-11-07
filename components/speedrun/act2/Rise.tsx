"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion, SR_EASE } from "@/lib/speedrun/motion";

const RISE_MS = 420;

// Fades and lifts its children in once when they mount. Nothing moves under reduced motion.
export function Rise({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    ref.current?.animate(
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: RISE_MS, easing: SR_EASE, fill: "backwards" },
    );
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
