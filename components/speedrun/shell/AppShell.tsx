import type { ReactNode } from "react";
import type { NetworkTab } from "@/lib/speedrun/phase";
import { NetworkTabs } from "../act2/NetworkTabs";
import { TopBar } from "./TopBar";

type AppShellProps = {
  name: string | null;
  tab: NetworkTab;
  onTab: (tab: NetworkTab) => void;
  onStartOver: () => void;
  onReplayTop: () => void;
  children: ReactNode;
};

// One viewport tall; the page never scrolls, each panel does. Below lg the tablist is the bottom row; from lg
// the shell is one centered column (clear of the fixed site logo on both sides) and the tablist shares the top bar's row. On a short landscape screen the height cap lifts and the page scrolls instead.
export function AppShell({ name, tab, onTab, onStartOver, onReplayTop, children }: AppShellProps) {
  return (
    <div
      data-shell=""
      className="grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-y-1 pt-20 [grid-template-areas:'top'_'main'_'tabs'] short-landscape:h-auto lg:mx-auto lg:w-[min(66rem,calc(100%-10rem))] lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-y-3 lg:pt-4 lg:[grid-template-areas:'brand_tabs_acct'_'main_main_main']"
    >
      <TopBar name={name} onStartOver={onStartOver} onReplayTop={onReplayTop} />
      <div data-shell-main="" className="relative z-10 min-h-0 [grid-area:main]">
        {children}
      </div>
      <NetworkTabs tab={tab} onTab={onTab} />
    </div>
  );
}
