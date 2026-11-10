"use client";

import { speedrunCopy } from "@/lib/content";

// The closing block. From lg it is part of the page, centered under both columns.
// Below lg it docks to the bottom of the viewport like an app's primary action: a
// solid surface (no backdrop blur) at z 10, after the content in DOM order.
export function HeroClose({ onStart }: { onStart: () => void }) {
  const copy = speedrunCopy.act1.closing;
  return (
    <div
      data-intro-el="close"
      data-intro-index="0"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center lg:static lg:border-0 lg:bg-transparent lg:p-0"
    >
      <p className="font-display text-xl leading-tight text-foreground sm:text-2xl lg:text-3xl">{copy.line}</p>
      <p className="mt-1 text-sm leading-snug text-muted lg:text-base">{copy.sub}</p>
      <button
        type="button"
        data-hero-start=""
        onClick={onStart}
        className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-accent px-8 font-label text-xl text-background transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto lg:mt-4"
      >
        {copy.button}
      </button>
    </div>
  );
}
