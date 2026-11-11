// Where the spotlight caption sits horizontally. Plain numbers in, plain numbers out, so it is testable without a DOM.

export const CAPTION_EDGE_PX = 16;
const CAPTION_CAP_PX = 352; // 22rem, the CSS cap in globals.css

type Span = { left: number; width: number };

/** The widest the caption may be on a phone: the CSS cap, the paragraph, and the 16 px gutters, whichever is smallest. */
export function phoneCaptionMaxWidth(paragraph: Span, viewportWidth: number): number {
  return Math.min(CAPTION_CAP_PX, paragraph.width, viewportWidth - 2 * CAPTION_EDGE_PX);
}

/**
 * Phones (Ruling 31): the caption starts at the paragraph's left edge, so a wrapped line lines up with the text above.
 * Everything else: centred under the lit words, then held 16 px off both edges (the original formula).
 */
export function captionLeft(input: { words: Span; paragraph: Span | null; captionWidth: number; viewportWidth: number; phone: boolean }): number {
  const { words, paragraph, captionWidth, viewportWidth, phone } = input;
  const farthest = Math.max(CAPTION_EDGE_PX, viewportWidth - CAPTION_EDGE_PX - captionWidth);
  const wanted = phone && paragraph ? paragraph.left : words.left + words.width / 2 - captionWidth / 2;
  return Math.min(Math.max(wanted, CAPTION_EDGE_PX), farthest);
}
