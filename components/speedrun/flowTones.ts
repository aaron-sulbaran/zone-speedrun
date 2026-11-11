// The flow chart's two palettes: "aaron" reads the site's --flow-* tokens, "speedrun" the --sr-* tokens.

export const TONES = {
  aaron: {
    link: { flow: "var(--flow-link)", open: "var(--flow-open)", rejected: "var(--flow-rejected)", noreply: "var(--flow-noreply)" },
    node: "var(--color-accent)",
    text: "var(--color-foreground)",
    subtext: "var(--color-muted)",
    halo: "var(--color-background)",
  },
  speedrun: {
    link: {
      flow: "color-mix(in srgb, var(--sr-ink) 70%, transparent)",
      open: "color-mix(in srgb, var(--sr-purple) 70%, transparent)",
      rejected: "color-mix(in srgb, var(--sr-ink) 42%, transparent)",
      noreply: "var(--sr-sec)",
    },
    node: "var(--sr-ink)",
    text: "var(--sr-ink)",
    subtext: "var(--sr-ink-2)",
    // The Board draws it on a white card, so the label backing is the card surface, not the page paper.
    halo: "var(--sr-surface)",
  },
} as const;

export type Tone = keyof typeof TONES;
