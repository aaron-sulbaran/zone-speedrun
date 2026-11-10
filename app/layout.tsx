import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { SiteLogo } from "@/components/SiteLogo";
import { siteContent } from "@/lib/content";
import { profaBlack, profaBold } from "@/lib/fonts";
import { THEME_BG_DARK, THEME_BG_LIGHT, themeInitScript } from "@/lib/theme";
import "./globals.css";

const onest = Onest({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  // The page's relative openGraph url and share card resolve to the site.
  metadataBase: new URL(siteContent.meta.url),
  title: siteContent.meta.title,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_BG_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_BG_DARK },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${onest.variable} ${profaBlack.variable} ${profaBold.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <a href="#main" className="skip-link">
          {siteContent.skipLinkLabel}
        </a>
        <SiteLogo />
        {children}
      </body>
    </html>
  );
}
