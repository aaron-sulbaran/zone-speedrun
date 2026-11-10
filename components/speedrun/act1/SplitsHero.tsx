"use client";

import { speedrunCopy } from "@/lib/content";
import { AARON_ENTRIES, aaronFlow } from "@/lib/speedrun/aaronMock";
import { useRef } from "react";
import { FlowChart } from "../FlowChart";
import { HeroClose } from "./HeroClose";
import { useHeroIntro } from "./useHeroIntro";

// Aaron's opener, drawn in its end state: every word is in the server HTML and the
// data-intro-el hooks mark what the intro motion animates. One screen from lg;
// below lg a single stack with the closing block docked to the bottom.

const flow = aaronFlow({ lanes: false });

// The subtitle's number sits in its own span so the intro can fly it into the chart.
function Subtitle() {
  const { before, count, after } = speedrunCopy.act1.subtitle;
  const total = AARON_ENTRIES.length;
  const full = count(total);
  const digits = String(total);
  const rest = full.startsWith(digits) ? full.slice(digits.length) : "";
  return (
    <p data-intro-el="subtitle" data-intro-index="0" className="mt-5 max-w-xl text-lg leading-snug text-foreground lg:text-xl">
      {before}
      <strong className="font-bold">
        <span data-hero-count="">{digits}</span>
        {rest}
      </strong>
      {after}
    </p>
  );
}

export function SplitsHero({ onStart }: { onStart: () => void }) {
  const copy = speedrunCopy.act1;
  const root = useRef<HTMLElement>(null);
  const { settled } = useHeroIntro(root);
  return (
    <section ref={root} data-hero="" data-act="1" className="relative flex min-h-dvh flex-col justify-center px-6 pb-40 pt-24 md:px-12 lg:pb-8 lg:pt-28 lg:[@media(max-height:820px)]:pt-24">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
        <header className="min-w-0">
          <p className="font-label text-label-sm uppercase text-muted">{copy.kicker}</p>
          <h1 data-phase-heading="" tabIndex={-1} className="mt-4 font-display text-4xl leading-[1.05] text-foreground focus:outline-none sm:text-5xl lg:text-[clamp(2.75rem,min(4.6vw,7.5vh),4rem)]">
            {copy.headline1.split(" ").map((word, index) => (
              <span key={word}>
                {index > 0 && " "}
                <span data-intro-el="word" data-intro-index={index} className="inline-block">
                  {word}
                </span>
              </span>
            ))}
            {" "}
            <span data-intro-el="second" data-intro-index="0" className="mt-1 block text-muted">
              {copy.headline2}
            </span>
          </h1>
          <Subtitle />
        </header>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <FlowChart data={flow} tone="aaron" size="hero" title={copy.flowTitle} />
          <p data-hero-chart-note="" className="mt-2 text-sm text-muted">{copy.privacyNote}</p>
        </div>
        <div className="min-w-0 space-y-4 text-base leading-relaxed text-foreground lg:col-start-1 lg:text-lg">
          {[copy.p1, copy.p2].map((text, index) => (
            <p key={index} data-intro-el="paragraph" data-intro-index={index}>
              {text}
            </p>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl lg:mt-8 lg:[@media(max-height:820px)]:mt-4">
        <HeroClose onStart={onStart} settled={settled} />
      </div>
    </section>
  );
}
