"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// Wraps the flow chart and draws its links in once, the first time the chart
// scrolls into view. Without JavaScript, or under reduced motion, the links
// simply show: they are only hidden after this component has armed itself.

const REDUCE = "(prefers-reduced-motion: reduce)";
const noop = () => () => {};
const motionAllowed = () => !window.matchMedia(REDUCE).matches;

export function FlowReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // False on the server and during hydration, so the links show until armed.
  const armed = useSyncExternalStore(noop, motionAllowed, () => false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!armed || !node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setDrawn(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [armed]);

  return (
    <div ref={ref} data-flow-armed={armed ? "" : undefined} data-flow-drawn={drawn ? "" : undefined}>
      {children}
    </div>
  );
}
