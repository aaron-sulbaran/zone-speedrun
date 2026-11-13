import { speedrunCopy } from "@/lib/content";
import type { Side } from "@/lib/speedrun/phase";
import { SpeedrunLogo } from "../SpeedrunLogo";
import { AccountMenu } from "./AccountMenu";
import { SideSwitch } from "./SideSwitch";

const copy = speedrunCopy.network;

type TopBarProps = { name: string | null; side: Side; onSide: (side: Side) => void; onStartOver: () => void; onReplayTop: () => void };

// Logo, wordmark and the account button on one row. The concept badge shares it from sm up; below sm it takes
// its own line underneath at full length, because the disclaimer must never be cut. No backdrop blur.
// From lg the header dissolves into the shell grid: brand left, the tablist in the middle, the switch slot
// and the avatar at the right edge. The Candidate / Talent team switch takes its own row under the bar below xl
// (right-aligned from sm, two equal halves below it); from xl it sits left of the avatar in the slot. Below xl the
// right-hand wrapper is `contents`, so the switch and the avatar are plain items of the header row (at lg, grid items).
// From lg to below xl the badge stacks under the logo and wordmark, so the tabs keep one line.
// From xl the badge sits inline beside the wordmark.
export function TopBar({ name, side, onSide, onStartOver, onReplayTop }: TopBarProps) {
  return (
    <header className="relative z-20 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 [grid-area:top] sm:px-6 lg:contents">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:items-start lg:gap-y-1 lg:px-2 lg:[grid-area:brand] xl:flex-row xl:items-center xl:gap-x-3">
        <div className="contents lg:flex lg:items-center lg:gap-3">
          <SpeedrunLogo className="h-4 w-auto shrink-0" />
          <span className="font-srcond text-sm uppercase tracking-widest text-sr-ink">{copy.wordmark}</span>
        </div>
        <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto">
          <span data-concept-badge="" className="inline-block max-w-full rounded-full bg-sr-hud px-3 py-1 font-srcond text-[11px] uppercase tracking-widest text-sr-ink2">
            {copy.badge}
          </span>
        </div>
      </div>
      <div className="contents xl:relative xl:z-20 xl:flex xl:items-center xl:gap-3 xl:px-2 xl:[grid-area:acct]">
        <div data-shell-switch-slot="" className="order-last min-w-0 basis-full sm:flex sm:justify-end lg:px-2 lg:[grid-area:sw] xl:order-none xl:block xl:basis-auto xl:shrink-0 xl:px-0">
          <SideSwitch side={side} onSide={onSide} />
        </div>
        <div className="relative z-20 ml-auto shrink-0 lg:ml-0 lg:self-center lg:justify-self-end lg:px-2 lg:[grid-area:acct] xl:px-0">
          <AccountMenu name={name} onStartOver={onStartOver} onReplayTop={onReplayTop} />
        </div>
      </div>
    </header>
  );
}
