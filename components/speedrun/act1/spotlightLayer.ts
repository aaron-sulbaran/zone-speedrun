import { beatOffsets, type IntroCue } from "@/lib/speedrun/heroIntro";
import { CAPTION_OUT_EASE, SPOTLIGHT_IN_EASE, SR_EASE, type Motion } from "@/lib/speedrun/motion";
import { flashKeyframes } from "@/lib/speedrun/spotlightFrames";

// The 84 spotlight: a body-level layer (so no stacking context inside the hero can trap it) holding a
// full-viewport veil, a lit copy of "84 applications" over it at the words' exact rect, and a caption.
// The originals never move; the lit copy fades in with the veil and out as it lifts (a crossfade, since
// only opacity and transform animate). All of the layer's look lives in globals.css.

const CAPTION_GAP_PX = 20;
const EDGE_PX = 16;

type Box = { left: number; top: number; width: number; height: number };

const scaleOf = (el: Element) => {
  const transform = getComputedStyle(el).transform;
  return transform === "none" ? 1 : new DOMMatrix(transform).a || 1;
};

// The element's rect with `owner`'s scale taken out. The flash scales the words about their centre, so
// a measure taken mid-pulse is undone exactly, and the lit copy always lands on the words at rest.
function restBox(el: Element, owner: Element): Box {
  const scale = scaleOf(owner);
  const rect = el.getBoundingClientRect();
  const o = owner.getBoundingClientRect();
  const cx = o.left + o.width / 2;
  const cy = o.top + o.height / 2;
  return { left: cx + (rect.left - cx) / scale, top: cy + (rect.top - cy) / scale, width: rect.width / scale, height: rect.height / scale };
}

/**
 * The longhands that set a line of type, read off the original. The `font` shorthand is not copied: some engines
 * serialize a computed shorthand as "", which would leave the copy in the body face and a different width.
 */
export function typeOf(source: Element) {
  const style = getComputedStyle(source);
  return { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, fontStyle: style.fontStyle, letterSpacing: style.letterSpacing };
}

// A copy for the layer: no data hooks (the page's pins and the intro read those), the light "lit" colour from CSS.
function litCopy(source: HTMLElement, marker: string): HTMLElement {
  const copy = source.cloneNode(true) as HTMLElement;
  for (const node of [copy, ...copy.querySelectorAll("*")]) for (const { name } of Array.from(node.attributes)) if (name.startsWith("data-")) node.removeAttribute(name);
  copy.setAttribute(marker, "");
  copy.setAttribute("aria-hidden", "true");
  return copy;
}

export type Spotlight = {
  /** Places the lit copy and the caption on the words again (fonts or a resize can move them). */
  place: () => void;
  /** The flash on the words and the veil, lit copy and caption over the beat; `move` carries the flying 84's lit twin. */
  play: (cues: { flash: IntroCue; veil: IntroCue; unveil: IntroCue }, m: Motion, move: string | null) => Animation[];
  remove: () => void;
};

export function mountSpotlight(words: HTMLElement, count: HTMLElement, captionText: string): Spotlight {
  const layer = document.createElement("div");
  const veil = document.createElement("div");
  const caption = document.createElement("p");
  const lit = litCopy(words, "data-spotlight-lit");
  const twin = litCopy(count, "data-spotlight-lit-count");
  layer.setAttribute("data-spotlight", "");
  layer.setAttribute("aria-hidden", "true");
  veil.setAttribute("data-spotlight-veil", "");
  caption.setAttribute("data-spotlight-caption", "");
  caption.textContent = captionText;
  layer.append(veil, lit, twin, caption);
  document.body.appendChild(layer);

  // Measured once, before any animation: where the number sits inside the words.
  const wordsBox = words.getBoundingClientRect();
  const countBox = count.getBoundingClientRect();
  const inside = { x: countBox.left - wordsBox.left, y: countBox.top - wordsBox.top, width: countBox.width, height: countBox.height };

  const fit = (el: HTMLElement, box: Box, source: HTMLElement) => {
    Object.assign(el.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, ...typeOf(source) });
  };
  const place = () => {
    const box = restBox(words, words);
    fit(lit, box, words);
    fit(twin, { left: box.left + inside.x, top: box.top + inside.y, width: inside.width, height: inside.height }, count);
    const width = caption.offsetWidth;
    const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, EDGE_PX), Math.max(EDGE_PX, document.documentElement.clientWidth - EDGE_PX - width));
    caption.style.left = `${left}px`;
    caption.style.top = `${box.top + box.height + CAPTION_GAP_PX}px`;
  };
  place();

  const play: Spotlight["play"] = ({ flash, veil: dim, unveil: out }, m, move) => {
    // Two pulses of the words, opacity and scale only; nothing is left at the end.
    const animations = [words.animate(flashKeyframes(m), { delay: flash.atMs, duration: flash.durationMs })];
    const offsets = beatOffsets(dim, out, m.introSpotlightCaptionOutMs);
    if (!offsets) return animations;
    // One animation per element, so no later one can override an earlier one's fill: in, hold, out.
    const timing: KeyframeAnimationOptions = { delay: dim.atMs, duration: offsets.totalMs, fill: "both" };
    const frames = (peak: number): Keyframe[] => [
      { opacity: 0, offset: 0, easing: SPOTLIGHT_IN_EASE },
      { opacity: peak, offset: offsets.settled },
      { opacity: peak, offset: offsets.held, easing: SR_EASE },
      { opacity: 0, offset: 1 },
    ];
    // The caption is gone when the flight starts, so the flying 84 never crosses it.
    const captionFrames: Keyframe[] = [
      { opacity: 0, offset: 0, easing: SPOTLIGHT_IN_EASE },
      { opacity: 1, offset: offsets.settled },
      { opacity: 1, offset: offsets.captionFrom, easing: CAPTION_OUT_EASE },
      { opacity: 0, offset: offsets.held },
      { opacity: 0, offset: 1 },
    ];
    animations.push(veil.animate(frames(m.introSpotlightVeilOpacity), timing), lit.animate(frames(1), timing), caption.animate(captionFrames, timing));
    // The 84's lit twin flies with the page-coloured clone and fades out as that one fades in.
    if (move) animations.push(twin.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: move }], { delay: out.atMs, duration: out.durationMs, easing: SR_EASE, fill: "forwards" }));
    return animations;
  };

  return { place, play, remove: () => layer.remove() };
}
