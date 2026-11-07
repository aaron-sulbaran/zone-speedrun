import type { Metadata } from "next";
import { Affiliation } from "@/components/speedrun/Affiliation";
import { AaronFunnel } from "@/components/speedrun/act1/AaronFunnel";
import { Opener } from "@/components/speedrun/act1/Opener";
import { Shift } from "@/components/speedrun/Shift";
import { SpeedrunLogo } from "@/components/speedrun/SpeedrunLogo";
import { siteContent, speedrunCopy } from "@/lib/content";
import { srCond, srSans } from "@/lib/speedrun/fonts";

export const metadata: Metadata = {
  title: { absolute: speedrunCopy.meta.title },
  description: speedrunCopy.meta.description,
  robots: { index: false, follow: false },
  // The page-level object replaces the layout's, so the preview is restated.
  openGraph: {
    title: speedrunCopy.meta.title,
    description: speedrunCopy.meta.description,
    url: "/speedrun",
    siteName: siteContent.meta.title,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: speedrunCopy.meta.title,
    description: speedrunCopy.meta.description,
  },
};

export default function SpeedrunPage() {
  return (
    <main id="main">
      <section data-act="1" className="px-6 pb-24 pt-32 md:px-12">
        <Opener />
        <AaronFunnel />
        <Shift targetId="act-2" />
      </section>
      <section
        id="act-2"
        tabIndex={-1}
        data-speedrun=""
        className={`focus:outline-none ${srSans.variable} ${srCond.variable} bg-sr-bg font-srsans text-sr-ink`}
      >
        <div className="px-6 py-24">
          <SpeedrunLogo className="h-8 w-auto" />
        </div>
        <Affiliation variant="pinned" />
      </section>
    </main>
  );
}
