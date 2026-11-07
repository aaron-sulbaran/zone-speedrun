"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, SR_COUNT_MS } from "@/lib/speedrun/motion";

// The number a visitor sees is never stale and never a stray 0.
// - Server render and reduced motion show the final value.
// - A tile that starts below the viewport counts up from 0 once, when it scrolls in
//   (the same rule as the flow chart's draw). One already on screen shows its final value.
// - `playOnMount` is for tiles that only exist after a user action (the board): they count up from 0 on arrival.
// - A later change of `value` tweens from the number on screen, not from 0.
export function CountUp({ value, playOnMount = false }: { value: number; playOnMount?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(() => (playOnMount && !prefersReducedMotion() ? 0 : value));
  const onScreen = useRef(shown);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const settle = (next: number) => {
      onScreen.current = next;
      setShown(next);
    };
    if (prefersReducedMotion()) {
      settle(value);
      return;
    }
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    const run = (from: number) => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SR_COUNT_MS);
        settle(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const first = !started.current;
    started.current = true;
    if (!first) run(onScreen.current);
    else if (playOnMount) run(0);
    else if (node.getBoundingClientRect().top < window.innerHeight) settle(value);
    else {
      settle(0);
      observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        observer?.disconnect();
        run(0);
      });
      observer.observe(node);
    }
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, playOnMount]);

  return (
    <span ref={ref} className="tabular-nums">
      <span aria-hidden="true">{shown.toLocaleString("en-US")}</span>
      <span className="sr-only">{value.toLocaleString("en-US")}</span>
    </span>
  );
}
