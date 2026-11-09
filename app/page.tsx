import type { Metadata } from "next";
import { BotIdClient } from "botid/client";
import { AaronFunnel } from "@/components/speedrun/act1/AaronFunnel";
import { Opener } from "@/components/speedrun/act1/Opener";
import { SpeedrunExperience } from "@/components/speedrun/SpeedrunExperience";
import { siteContent, speedrunCopy } from "@/lib/content";
import { srCond, srSans } from "@/lib/speedrun/fonts";
import { liveFlags } from "@/lib/speedrun/guard";
import { getSnapshot } from "@/lib/speedrun/snapshot";

// BotID rides along only on this page, and only on the two requests that spend money or send mail.
const BOT_PROTECTED = [
  { path: "/speedrun/api/read", method: "POST" },
  { path: "/speedrun/api/brief", method: "POST" },
];

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

export default function SpeedrunPage() {
  const snapshot = getSnapshot();
  const stats = {
    companies: snapshot.companies.filter((company) => company.slug !== FUND_SLUG).length,
    roles: snapshot.roles.filter((role) => role.tier === "speedrun").length,
    fetchedAt: snapshot.fetchedAt,
  };
  return (
    <main id="main">
      {/* An inline script: /speedrun must be entered by a full page load, never a next/link, or it never runs. */}
      <BotIdClient protect={BOT_PROTECTED} />
      <SpeedrunExperience
        opener={
          <>
            <Opener />
            <AaronFunnel />
          </>
        }
        live={liveFlags()}
        stats={stats}
        themeClassName={`${srSans.variable} ${srCond.variable} bg-sr-bg font-srsans text-sr-ink`}
      />
    </main>
  );
}
