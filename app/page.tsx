import type { Metadata } from "next";
import { BotIdClient } from "botid/client";
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

// Public files carry the basePath themselves, and metadataBase makes the url absolute.
const SHARE_CARD = { url: "/speedrun/splits-card.png", width: 2400, height: 1260, alt: speedrunCopy.meta.cardAlt };

export const metadata: Metadata = {
  title: { absolute: speedrunCopy.meta.title },
  description: speedrunCopy.meta.description,
  robots: { index: false, follow: false },
  // A page-level openGraph or twitter object replaces the layout's whole object,
  // and the file-based share card only attaches to the objects that have no
  // images of their own, so this page's own card (public/splits-card.png) is
  // named here and the rest is restated.
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
    images: [{ url: SHARE_CARD.url, alt: SHARE_CARD.alt }],
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
        live={liveFlags()}
        stats={stats}
        themeClassName={`${srSans.variable} ${srCond.variable} bg-sr-bg font-srsans text-sr-ink`}
      />
    </main>
  );
}
