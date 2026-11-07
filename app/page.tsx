import type { Metadata } from "next";
import { Affiliation } from "@/components/speedrun/Affiliation";
import { AaronFunnel } from "@/components/speedrun/act1/AaronFunnel";
import { Opener } from "@/components/speedrun/act1/Opener";
import { SpeedrunDemo } from "@/components/speedrun/SpeedrunDemo";
import { Shift } from "@/components/speedrun/Shift";
import { SrZone } from "@/components/speedrun/SrZone";
import { siteContent, speedrunCopy } from "@/lib/content";
import { srCond, srSans } from "@/lib/speedrun/fonts";
import { getSnapshot } from "@/lib/speedrun/snapshot";

const SHARE_CARD = { url: "/opengraph-image", width: 1200, height: 630, alt: siteContent.meta.title };

export const metadata: Metadata = {
  title: { absolute: speedrunCopy.meta.title },
  description: speedrunCopy.meta.description,
  robots: { index: false, follow: false },
  // A page-level openGraph or twitter object replaces the layout's whole object,
  // and the file-based share card only attaches to the objects that have no
  // images of their own, so the card is named here (the root opengraph-image
  // route, 1200 by 630) and the rest is restated.
  openGraph: {
    title: speedrunCopy.meta.title,
    description: speedrunCopy.meta.description,
    url: "/speedrun",
    siteName: siteContent.meta.title,
    type: "website",
    images: [SHARE_CARD],
  },
  twitter: {
    card: "summary_large_image",
    title: speedrunCopy.meta.title,
    description: speedrunCopy.meta.description,
    images: [SHARE_CARD.url],
  },
};

const FUND_SLUG = "speedrun";

// Switches are explicit flags, never key presence: on Vercel the AI Gateway
// signs in with an automatic token, so a key check alone would turn spend on.
function liveFlags() {
  return {
    reading: process.env.SPEEDRUN_AI === "on",
    email:
      process.env.SPEEDRUN_EMAIL === "on" &&
      Boolean(process.env.RESEND_API_KEY) &&
      Boolean(process.env.SPEEDRUN_EMAIL_FROM),
  };
}

export default function SpeedrunPage() {
  const snapshot = getSnapshot();
  const stats = {
    companies: snapshot.companies.filter((company) => company.slug !== FUND_SLUG).length,
    roles: snapshot.roles.filter((role) => role.tier === "speedrun").length,
    fetchedAt: snapshot.fetchedAt,
  };
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
        <SrZone targetId="act-2" />
        <SpeedrunDemo live={liveFlags()} stats={stats} />
        <Affiliation variant="pinned" />
      </section>
    </main>
  );
}
