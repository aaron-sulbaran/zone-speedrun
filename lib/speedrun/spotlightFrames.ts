import { FLASH_EASE, type Motion } from "./motion";

/**
 * The two pulses of "84 applications", opacity and scale only, each easing in and out on its own and ending
 * at rest. Pure, so the amplitude's wiring to the Motion keys is unit-tested rather than read off a page.
 */
export function flashKeyframes(m: Pick<Motion, "introSpotlightFlashScale" | "introSpotlightFlashOpacity">): Keyframe[] {
  const rest = { transform: "scale(1)", opacity: 1 };
  const pulse = { transform: `scale(${m.introSpotlightFlashScale})`, opacity: m.introSpotlightFlashOpacity };
  return [{ ...rest, easing: FLASH_EASE }, { ...pulse, easing: FLASH_EASE }, { ...rest, easing: FLASH_EASE }, { ...pulse, easing: FLASH_EASE }, rest];
}
