import { speedrunCopy } from "@/lib/content";
import { SpeedrunLogo } from "../SpeedrunLogo";
import { AccountMenu } from "./AccountMenu";

const copy = speedrunCopy.network;

type TopBarProps = { name: string | null; onStartOver: () => void; onReplayTop: () => void };

// Logo, wordmark, the concept badge at every width, and the account button at the end. No backdrop blur.
export function TopBar({ name, onStartOver, onReplayTop }: TopBarProps) {
  return (
    <header className="relative z-20 flex min-w-0 items-center gap-3 px-4 py-2 [grid-area:top] sm:px-6">
      <SpeedrunLogo className="h-4 w-auto shrink-0" />
      <span className="font-srcond text-sm uppercase tracking-widest text-sr-ink">{copy.wordmark}</span>
      <span data-concept-badge="" className="min-w-0 truncate rounded-full bg-sr-hud px-3 py-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">
        {copy.badge}
      </span>
      <div className="ml-auto shrink-0">
        <AccountMenu name={name} onStartOver={onStartOver} onReplayTop={onReplayTop} />
      </div>
    </header>
  );
}
