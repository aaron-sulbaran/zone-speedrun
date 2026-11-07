import { speedrunCopy } from "@/lib/content";

export function SpeedrunLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-egg-logo="" src="/speedrun/speedrun-logo.svg" alt={speedrunCopy.logoAlt} width={3081} height={427} className={className} />;
}
