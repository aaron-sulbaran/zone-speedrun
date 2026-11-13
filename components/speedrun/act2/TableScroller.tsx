"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The table scrolls sideways inside its card below lg. A fade on the right edge says more columns wait there,
// and goes once the scroll reaches the end. It never takes a pointer and does not animate under reduced motion.
export function TableScroller({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    if (el.firstElementChild) watcher.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      watcher.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div ref={box} data-table-scroll="" className="overflow-x-auto rounded-2xl border border-sr-soft bg-sr-surface">
        {children}
      </div>
      <div
        aria-hidden="true"
        data-table-fade=""
        data-more={more}
        className={`pointer-events-none absolute inset-y-px right-px w-12 rounded-r-2xl bg-gradient-to-l from-sr-surface to-transparent transition-opacity duration-200 motion-reduce:transition-none lg:hidden ${more ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
