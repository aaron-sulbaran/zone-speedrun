import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        border: "var(--color-border)",
        glass: "var(--color-glass)",
        "glass-strong": "var(--color-glass-strong)",
        sr: {
          bg: "var(--sr-bg)",
          ink: "var(--sr-ink)",
          ink2: "var(--sr-ink-2)",
          surface: "var(--sr-surface)",
          hud: "var(--sr-hud)",
          soft: "var(--sr-soft)",
          strong: "var(--sr-strong)",
          sec: "var(--sr-sec)",
          purple: "var(--sr-purple)",
          aqua: "var(--sr-aqua)",
          term: "var(--sr-term)",
          foot: "var(--sr-foot)",
        },
      },
      transitionTimingFunction: {
        sr: "cubic-bezier(.16,1,.3,1)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // /speedrun's Act 2 lookalike faces (lib/speedrun/fonts.ts).
        srsans: ["var(--font-sr-sans)", "system-ui", "sans-serif"],
        srcond: ["var(--font-sr-cond)", "system-ui", "sans-serif"],
        // The label face. Profa takes its defaults.
        label: [["var(--font-label)", "var(--font-sans)", "system-ui", "sans-serif"], { fontFeatureSettings: "normal" }],
      },
      fontSize: {
        "display-sm": ["clamp(3rem, 8vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "body-lg": ["1.25rem", { lineHeight: "1.6" }],
        // The label face's steps. Weight lives here so the body-face fallback is bold too.
        "label-sm": ["0.795rem", { letterSpacing: "0.01em", fontWeight: "700" }],
        "label": ["0.9275rem", { lineHeight: "1.25rem", letterSpacing: "0.01em", fontWeight: "700" }],
        "label-lg": ["1.1925rem", { letterSpacing: "0.01em", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
};
export default config;
