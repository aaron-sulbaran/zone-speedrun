import { siteContent } from "@/lib/content";

// The site's AS logo, static: the bolt with the A beneath it, in currentColor so
// it reads ink in light and paper in dark through the text token. A plain link
// back to the site; none of the site's hold-to-open card lives here.
const VIEW_BOX = "2.49 6.34 243.32 243.32";
const BOLT_D = "M90.29 83.58L162.35 23.12L134.45 92.18L196.11 105.28L131.2 229.2L160.4 129.67L78.69 112.3Z";
const LEG_D = "M151.62 133.45L52.19 232.88L65.2 232.88L132.65 165.43L122.98 198.37L123.53 229.2Z";
const BAR_D = "M102.4 189.17L135.27 189.17L132.57 198.37L93.2 198.37Z";

export function SiteLogo() {
  return (
    // A plain anchor on purpose: next/link would prefix the /speedrun basePath, and this goes to the site's root.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/"
      aria-label={siteContent.logoAriaLabel}
      className="site-logo fixed left-4 top-4 z-40 block h-8 w-8 text-foreground sm:left-6 sm:h-10 sm:w-10"
    >
      <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="block h-full w-full">
        <path d={BOLT_D} fill="currentColor" />
        <path d={LEG_D} fill="currentColor" />
        <path d={BAR_D} fill="currentColor" />
      </svg>
    </a>
  );
}
