import type { Metadata } from "next";
import { Affiliation } from "@/components/speedrun/Affiliation";
import { SpeedrunLogo } from "@/components/speedrun/SpeedrunLogo";
import { speedrunCopy } from "@/lib/content";
import { srCond, srSans } from "@/lib/speedrun/fonts";

export const metadata: Metadata = {
  title: speedrunCopy.meta.title,
  description: speedrunCopy.meta.description,
  robots: { index: false, follow: false },
};

export default function SpeedrunPage() {
  return (
    <main id="main">
      <section data-act="1" className="px-6 pb-24 pt-32">
        <Affiliation variant="inline" />
      </section>
      <section
        data-speedrun=""
        className={`${srSans.variable} ${srCond.variable} bg-sr-bg font-srsans text-sr-ink`}
      >
        <div className="px-6 py-24">
          <SpeedrunLogo className="h-8 w-auto" />
        </div>
        <Affiliation variant="pinned" />
      </section>
    </main>
  );
}
