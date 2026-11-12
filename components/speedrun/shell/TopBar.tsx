import { speedrunCopy } from "@/lib/content";
import { SpeedrunLogo } from "../SpeedrunLogo";
import { AccountMenu } from "./AccountMenu";

const copy = speedrunCopy.network;

type TopBarProps = { name: string | null; onStartOver: () => void; onReplayTop: () => void };

// Logo, wordmark and the account button on one row. The concept badge shares it from sm up; below sm it takes
// its own line underneath at full length, because the disclaimer must never be cut. No backdrop blur.
// From lg the badge stacks under the brand until xl, so the tabs keep one line. From lg the header dissolves into the shell grid: brand left, the tablist in the middle, the switch slot
// and the avatar at the right edge. The slot is PR 7's mount for a recruiter view's team switch; it renders nothing.
export function TopBar({ name, onStartOver, onReplayTop }: TopBarProps) {
  return (
    <header className="relative z-20 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 [grid-area:top] sm:px-6 lg:contents">
      <div className="contents lg:flex lg:min-w-0 lg:flex-wrap lg:items-center lg:gap-x-3 lg:gap-y-1 lg:px-2 lg:[grid-area:brand] xl:flex-nowrap">
        <SpeedrunLogo className="h-4 w-auto shrink-0" />
        <span className="font-srcond text-sm uppercase tracking-widest text-sr-ink">{copy.wordmark}</span>
        <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto lg:basis-full xl:basis-auto">
          <span data-concept-badge="" className="inline-block max-w-full rounded-full bg-sr-hud px-3 py-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">
            {copy.badge}
          </span>
        </div>
      </div>
      <div className="relative z-20 ml-auto shrink-0 lg:ml-0 lg:flex lg:items-center lg:gap-3 lg:px-2 lg:[grid-area:acct]">
        <div data-shell-switch-slot="" aria-hidden="true" className="hidden h-10 w-40 shrink-0 lg:block" />
        <AccountMenu name={name} onStartOver={onStartOver} onReplayTop={onReplayTop} />
      </div>
    </header>
  );
}
