"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { speedrunCopy } from "@/lib/content";
import { introCues, pressableAtMs } from "@/lib/speedrun/heroIntro";
import { registerIntroHold } from "@/lib/speedrun/introHold";
import { motion, prefersReducedMotion, SR_EASE } from "@/lib/speedrun/motion";
import { mountSpotlight, typeOf, type Spotlight } from "./spotlightLayer";

// The root carries the intro state for CSS and for the e2e pins.
function setIntro(el: HTMLElement, state: "running" | "done") {
  el.dataset.intro = state;
}

const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"] as const;

// checkVisibility is missing before Safari 17.4; a rendered element has client rects.
const isShown = (el: Element) => (el as Element & { checkVisibility?: () => boolean }).checkVisibility?.() ?? el.getClientRects().length > 0;
const visibleOne = (root: HTMLElement, selector: string) => Array.from(root.querySelectorAll<SVGElement>(selector)).find(isShown) ?? null;
const byIndex = (a: HTMLElement, b: HTMLElement) => Number(a.dataset.introIndex) - Number(b.dataset.introIndex);

const fullyInView = (rect: DOMRect) => rect.top >= 0 && rect.left >= 0 && rect.bottom <= document.documentElement.clientHeight && rect.right <= document.documentElement.clientWidth;

// Builds the flying copy of the subtitle's number, positioned over the original inside the hero.
function makeClone(root: HTMLElement, source: HTMLElement, rootRect: DOMRect, from: DOMRect) {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-hero-count");
  clone.setAttribute("data-intro-flight", "");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    position: "absolute",
    left: `${from.left - rootRect.left}px`,
    top: `${from.top - rootRect.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    opacity: "0",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    zIndex: "44", // above the spotlight layer (42), which sits at the page's root stacking context
    transformOrigin: "center",
    ...typeOf(source),
    fontWeight: "700",
    color: getComputedStyle(source).color,
  });
  root.appendChild(clone);
  return clone;
}

// Plays the hero's intro with Web Animations and marks the root's data-intro: "running", then "done".
// Any input finishes it in the same tick (bubble-phase listeners, so a press on the button records its
// state first). Reduced motion, and a page without JavaScript, show the end state.
export function useHeroIntro(root: RefObject<HTMLElement | null>): { settled: () => boolean } {
  // The closing button is pressable from its own cue, not only once the whole intro has finished.
  const pressableAt = useRef<number | null>(null);
  // Held in a ref: React Strict Mode runs the effect twice in dev, and the second run reads scrollY 0 while the first run's scroll is still on its way.
  const returning = useRef(false);
  const settled = () => root.current?.dataset.intro === "done" || (pressableAt.current !== null && performance.now() >= pressableAt.current);

  useLayoutEffect(() => {
    const found = root.current;
    if (!found) return;
    const el: HTMLElement = found;
    if (prefersReducedMotion()) {
      setIntro(el, "done");
      return;
    }
    // A hydration slower than the CSS failsafe finds the words already shown: never replay them.
    const firstWord = el.querySelector("[data-intro-el]");
    if (firstWord && getComputedStyle(firstWord).opacity === "1") {
      setIntro(el, "done");
      return;
    }
    setIntro(el, "running");
    const startedAt = performance.now();
    // The intro plays from the top (a replay from a scrolled phase remounts this hero before the page returns to the top), and the scroll
    // this causes must not count as the reader's: measure from the top, and swallow the one scroll event that move delivers (it can land any
    // number of frames later) by its position, the top, instead of by a frame count.
    returning.current ||= window.scrollY > 0;
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" });

    const m = motion();
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-intro-el]"));
    const of = (kind: string) => items.filter((item) => item.dataset.introEl === kind).sort(byIndex);
    const words = of("word");
    const paragraphs = of("paragraph");
    const subtitleWords = of("subtitle");
    const cues = introCues(m, { words: words.length, subtitleWords: subtitleWords.length, paragraphs: paragraphs.length });
    pressableAt.current = startedAt + pressableAtMs(cues);

    // Measure before any animation moves things.
    const count = el.querySelector<HTMLElement>("[data-hero-count]");
    const value = visibleOne(el, "[data-flow-source-value]");
    const chart = visibleOne(el, "[data-flow-content]");
    const note = el.querySelector("[data-hero-chart-note]");
    const rootRect = el.getBoundingClientRect();
    const from = count?.getBoundingClientRect();
    const to = value?.getBoundingClientRect();
    // The beat is skipped when the number or its words are missing, or when the words are not fully on screen (a short window or a
    // page already scrolled), since the veil would light something the reader cannot see. With the chart's value hidden it plays without the flight.
    const spotlightWords = el.querySelector<HTMLElement>("[data-hero-spotlight]");
    const wordsInView = !!spotlightWords && fullyInView(spotlightWords.getBoundingClientRect());
    const spotlight: Spotlight | null = spotlightWords && count && wordsInView ? mountSpotlight(spotlightWords, count, speedrunCopy.act1.spotlightCaption) : null;
    let flightMove: string | null = null;

    const animations: Animation[] = [];
    let clone: HTMLElement | null = null;
    const fade = (target: Element, atMs: number, durationMs: number) =>
      animations.push(
        target.animate(
          [
            { opacity: 0, transform: `translateY(${m.introRisePx}px)` },
            { opacity: 1, transform: "none" },
          ],
          { delay: atMs, duration: durationMs, easing: SR_EASE, fill: "both" },
        ),
      );

    for (const cue of cues) {
      if (cue.target === "word") fade(words[cue.index], cue.atMs, cue.durationMs);
      else if (cue.target === "subtitle") fade(subtitleWords[cue.index], cue.atMs, cue.durationMs);
      else if (cue.target === "paragraph") fade(paragraphs[cue.index], cue.atMs, cue.durationMs);
      else if (cue.target === "flight") {
        if (!count || !value || !from || !to || !to.width) continue;
        clone = makeClone(el, count, rootRect, from);
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const scale = to.width / from.width;
        flightMove = `translate(${dx}px, ${dy}px) scale(${scale})`;
        const flying = clone;
        const flight = flying.animate(
          [
            // The page-coloured 84 fades in as its lit twin (on the veil) fades out.
            { opacity: 0, transform: "none" },
            { opacity: 1, transform: flightMove },
          ],
          { delay: cue.atMs, duration: cue.durationMs, easing: SR_EASE, fill: "forwards" },
        );
        animations.push(flight);
        // The clone leaves the moment it lands, as the chart's own value takes its place.
        flight.finished.then(() => flying.remove(), () => {});
      } else if (cue.target === "links") {
        // The whole chart (nodes, labels and links) spawns left to right from where the 84 lands.
        if (!chart) continue;
        animations.push(
          chart.animate(
            [
              { opacity: 1, clipPath: "inset(0 100% 0 0)" },
              { opacity: 1, clipPath: "inset(0 0 0 0)" },
            ],
            { delay: cue.atMs, duration: cue.durationMs, easing: SR_EASE, fill: "both" },
          ),
        );
        if (note) animations.push(note.animate([{ opacity: 0 }, { opacity: 1 }], { delay: cue.atMs + cue.durationMs - m.introWordMs, duration: m.introWordMs, fill: "both" }));
      } else if (cue.target === "second" || cue.target === "close") {
        const target = of(cue.target)[cue.index];
        if (target) fade(target, cue.atMs, cue.durationMs);
      }
    }
    const beat = (target: "flash" | "veil" | "unveil") => cues.find((cue) => cue.target === target)!;
    if (spotlight) animations.push(...spotlight.play({ flash: beat("flash"), veil: beat("veil"), unveil: beat("unveil") }, m, flightMove));

    // Fonts can move the words after the first measure; place the lit copy again once they are in.
    const replace = () => spotlight?.place();
    let releaseHold: (() => void) | undefined;

    const stopListening = () => {
      SKIP_EVENTS.forEach((type) => document.removeEventListener(type, skip));
      document.removeEventListener("scroll", onScroll);
    };
    const complete = () => {
      if (el.dataset.intro === "done") return;
      clone?.remove();
      spotlight?.remove();
      window.removeEventListener("resize", replace);
      releaseHold?.();
      stopListening();
      setIntro(el, "done");
      // The CSS done rule holds the end state; drop the fill so no clip lingers on the chart at rest.
      animations.forEach((animation) => animation.cancel());
    };
    function skip(event: Event) {
      if (el.dataset.intro !== "running") return;
      // The dev tuning panel is not the reader: touching it must not end the intro.
      if (event.target instanceof Element && event.target.closest("[data-tuning-panel]")) return;
      animations.forEach((animation) => animation.finish());
      complete();
    }
    // "scroll" covers a scrollbar drag and a script that moves the page; the dim should not hold a reader who is already leaving it.
    function onScroll(event: Event) {
      if (returning.current && window.scrollY === 0) {
        returning.current = false;
        return;
      }
      skip(event);
    }
    SKIP_EVENTS.forEach((type) => document.addEventListener(type, skip, { passive: true }));
    document.addEventListener("scroll", onScroll, { passive: true });
    Promise.all(animations.map((animation) => animation.finished)).then(complete, () => {});

    document.fonts?.ready.then(() => el.dataset.intro === "running" && replace());
    window.addEventListener("resize", replace);
    if (process.env.NODE_ENV === "development") releaseHold = registerIntroHold(animations);

    return () => {
      releaseHold?.();
      window.removeEventListener("resize", replace);
      stopListening();
      animations.forEach((animation) => animation.cancel());
      clone?.remove();
      spotlight?.remove();
    };
  }, [root]);

  return { settled };
}
