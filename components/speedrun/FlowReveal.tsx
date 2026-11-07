"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// Wraps the flow chart and draws its links in once, when the chart scrolls into
// view. It only arms (hides the links) when the chart starts below the viewport
// and motion is allowed, so a reload with the chart on screen never flashes and
// reduced motion, or no JavaScript, simply shows the links. The attributes are
// set on the element directly, not through state, so nothing re-renders.

const REDUCE = "(prefers-reduced-motion: reduce)";
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function FlowReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useBeforePaint(() => {
    const node = ref.current;
    if (!node || window.matchMedia(REDUCE).matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.setAttribute("data-flow-armed", "");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.setAttribute("data-flow-drawn", "");
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
