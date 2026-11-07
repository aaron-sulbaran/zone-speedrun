import { Inter_Tight, Roboto_Condensed } from "next/font/google";

// Lookalikes for the talent network's faces; their own files are never added.
export const srSans = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "900"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sr-sans",
});

export const srCond = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-sr-cond",
});
