"use client";

import { useLayoutEffect, type RefObject } from "react";
import { introCues } from "@/lib/speedrun/heroIntro";
import { motion, prefersReducedMotion, SR_EASE } from "@/lib/speedrun/motion";

// The root carries the intro state for CSS and for the e2e pins.
function setIntro(el: HTMLElement, state: "running" | "done") {
  el.dataset.intro = state;
}

const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"] as const;

const visibleOne = (root: HTMLElement, selector: string) => Array.from(root.querySelectorAll<SVGElement>(selector)).find((el) => el.checkVisibility()) ?? null;
const byIndex = (a: HTMLElement, b: HTMLElement) => Number(a.dataset.introIndex) - Number(b.dataset.introIndex);

// Builds the flying copy of the subtitle's number, positioned over the original inside the hero.
function makeClone(root: HTMLElement, source: HTMLElement, rootRect: DOMRect, from: DOMRect) {
  const clone = source.cloneNode(true) as HTMLElement;
  const style = getComputedStyle(source);
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
    transformOrigin: "center",
    font: style.font,
    fontWeight: "700",
    color: style.color,
  });
  root.appendChild(clone);
  return clone;
}

// Plays the hero's intro with Web Animations and marks the root's data-intro: "running", then "done".
// Any input finishes it in the same tick (bubble-phase listeners, so a press on the button records its
// state first). Reduced motion, and a page without JavaScript, show the end state.
export function useHeroIntro(root: RefObject<HTMLElement | null>): { settled: () => boolean } {
  const settled = () => root.current?.dataset.intro === "done";

  useLayoutEffect(() => {
    const found = root.current;
    if (!found) return;
    const el: HTMLElement = found;
    if (prefersReducedMotion()) {
      setIntro(el, "done");
      return;
    }
    setIntro(el, "running");

    const m = motion();
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-intro-el]"));
    const of = (kind: string) => items.filter((item) => item.dataset.introEl === kind).sort(byIndex);
    const words = of("word");
    const paragraphs = of("paragraph");
    const cues = introCues(m, { words: words.length, paragraphs: paragraphs.length });

    // Measure before any animation moves things.
    const count = el.querySelector<HTMLElement>("[data-hero-count]");
    const value = visibleOne(el, "[data-flow-source-value]");
    const links = visibleOne(el, "[data-flow-links]");
    const rootRect = el.getBoundingClientRect();
    const from = count?.getBoundingClientRect();
    const to = value?.getBoundingClientRect();

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
      else if (cue.target === "paragraph") fade(paragraphs[cue.index], cue.atMs, cue.durationMs);
      else if (cue.target === "flight") {
        if (!count || !value || !from || !to || !to.width) continue;
        clone = makeClone(el, count, rootRect, from);
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const scale = to.width / from.width;
        animations.push(
          clone.animate(
            [
              { opacity: 1, transform: "none" },
              { opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
            ],
            { delay: cue.atMs, duration: cue.durationMs, easing: SR_EASE, fill: "forwards" },
          ),
        );
        // The chart's own value waits for the clone to land.
        animations.push(value.animate([{ opacity: 0 }, { opacity: 0 }], { duration: cue.atMs + cue.durationMs }));
      } else if (cue.target === "links") {
        if (!links) continue;
        animations.push(
          links.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
            delay: cue.atMs,
            duration: cue.durationMs,
            easing: SR_EASE,
            fill: "both",
          }),
        );
      } else {
        const target = of(cue.target)[cue.index];
        if (target) fade(target, cue.atMs, cue.durationMs);
      }
    }

    const stopListening = () => SKIP_EVENTS.forEach((type) => document.removeEventListener(type, skip));
    const complete = () => {
      if (el.dataset.intro === "done") return;
      clone?.remove();
      stopListening();
      setIntro(el, "done");
    };
    function skip() {
      if (el.dataset.intro !== "running") return;
      animations.forEach((animation) => animation.finish());
      complete();
    }
    SKIP_EVENTS.forEach((type) => document.addEventListener(type, skip, { passive: true }));
    Promise.all(animations.map((animation) => animation.finished)).then(complete, () => {});

    return () => {
      stopListening();
      animations.forEach((animation) => animation.cancel());
      clone?.remove();
    };
  }, [root]);

  return { settled };
}
