"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, SR_COUNT_MS } from "@/lib/speedrun/motion";

// Shows the final value on the server render and under reduced motion. Otherwise
// it counts from 0 once, the first time it scrolls into view (cubic ease-out).
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    setShown(0);
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SR_COUNT_MS);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("en-US")}
    </span>
  );
}
