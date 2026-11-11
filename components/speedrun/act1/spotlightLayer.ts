import { SR_EASE, type Motion } from "@/lib/speedrun/motion";
import type { IntroCue } from "@/lib/speedrun/heroIntro";

// The 84 spotlight: a body-level layer (so no stacking context inside the hero can trap it) with a
// veil that has a soft elliptical hole over "84 applications", and a caption under the hole. The words
// stay where they are; the layer only dims everything else. All of its look lives in globals.css.

const FEATHER = 0.6; // the hole is clear to this share of the ellipse (matches the CSS gradient)
const CAPTION_GAP_PX = 4;
const EDGE_PX = 16;

export type SpotlightLayer = {
  /** Measures the words again and places the hole and the caption. */
  place: () => void;
  /** The veil's and the caption's opacity over the beat, as Web Animations on the layer. */
  animate: (veil: IntroCue, unveil: IntroCue, m: Motion) => Animation[];
  remove: () => void;
};

export function mountSpotlight(words: HTMLElement, captionText: string, padPx: number): SpotlightLayer {
  const layer = document.createElement("div");
  const veil = document.createElement("div");
  const caption = document.createElement("p");
  layer.setAttribute("data-spotlight", "");
  layer.setAttribute("aria-hidden", "true");
  veil.setAttribute("data-spotlight-veil", "");
  caption.setAttribute("data-spotlight-caption", "");
  caption.textContent = captionText;
  layer.append(veil, caption);
  document.body.appendChild(layer);

  const place = () => {
    const rect = words.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const reach = (half: number) => ((half + padPx) * Math.SQRT2) / FEATHER;
    veil.style.setProperty("--hole-x", `${cx}px`);
    veil.style.setProperty("--hole-y", `${rect.top + rect.height / 2}px`);
    veil.style.setProperty("--hole-rx", `${reach(rect.width / 2)}px`);
    const ry = reach(rect.height / 2);
    veil.style.setProperty("--hole-ry", `${ry}px`);
    const width = caption.offsetWidth;
    const left = Math.min(Math.max(cx - width / 2, EDGE_PX), Math.max(EDGE_PX, document.documentElement.clientWidth - EDGE_PX - width));
    caption.style.left = `${left}px`;
    // Under the whole feathered hole, so the caption sits on the veil, not on its soft edge.
    caption.style.top = `${rect.top + rect.height / 2 + ry + CAPTION_GAP_PX}px`;
  };
  place();

  const animate = (dim: IntroCue, out: IntroCue, m: Motion) => {
    // One animation per element, so no later one can override an earlier one's fill: in, hold, out.
    const total = out.atMs + out.durationMs - dim.atMs;
    const held = (dim.durationMs + (out.atMs - dim.atMs - dim.durationMs)) / total;
    const settled = dim.durationMs / total;
    const timing: KeyframeAnimationOptions = { delay: dim.atMs, duration: total, fill: "both" };
    const frames = (peak: number): Keyframe[] => [
      { opacity: 0, offset: 0, easing: "ease-out" },
      { opacity: peak, offset: settled },
      { opacity: peak, offset: held, easing: SR_EASE },
      { opacity: 0, offset: 1 },
    ];
    return [veil.animate(frames(m.introSpotlightVeilOpacity), timing), caption.animate(frames(1), timing)];
  };

  return { place, animate, remove: () => layer.remove() };
}
