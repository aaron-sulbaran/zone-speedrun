import { speedrunCopy } from "@/lib/content";
import { SpeedrunLogo } from "../SpeedrunLogo";
import { AccountMenu } from "./AccountMenu";

const copy = speedrunCopy.network;

type TopBarProps = { name: string | null; onStartOver: () => void; onReplayTop: () => void };

// Logo, wordmark and the account button on one row. The concept badge shares it from sm up; below sm it takes
// its own line underneath at full length, because the disclaimer must never be cut. No backdrop blur.
export function TopBar({ name, onStartOver, onReplayTop }: TopBarProps) {
  return (
    <header className="relative z-20 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 [grid-area:top] sm:px-6">
      <SpeedrunLogo className="h-4 w-auto shrink-0" />
      <span className="font-srcond text-sm uppercase tracking-widest text-sr-ink">{copy.wordmark}</span>
      <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto">
        <span data-concept-badge="" className="inline-block max-w-full rounded-full bg-sr-hud px-3 py-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">
          {copy.badge}
        </span>
      </div>
      <div className="ml-auto shrink-0">
        <AccountMenu name={name} onStartOver={onStartOver} onReplayTop={onReplayTop} />
      </div>
    </header>
  );
}
