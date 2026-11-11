// A phone held sideways (844 by 390): wide enough for the desktop layouts, too short for sticky bars.
// The shell, the phases and the join card style it as the `short-landscape` variant (tailwind.config.ts reads this string),
// and script reads the same condition through matchMedia, so the two can never drift apart.
export const SHORT_LANDSCAPE = "(max-height: 559px) and (orientation: landscape)";
