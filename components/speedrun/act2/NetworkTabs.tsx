"use client";

import { CircleHelp, LayoutDashboard, Mail, Users, type LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import { NETWORK_TABS, type NetworkTab } from "@/lib/speedrun/phase";

const copy = speedrunCopy.network;
const ICONS: Record<NetworkTab, LucideIcon> = { matches: Users, board: LayoutDashboard, brief: Mail, decisions: CircleHelp };

// A filled button below lg; from lg a quiet text link, so it never reads as the selected tab.
export const NEXT_LINK = "rounded-full bg-sr-ink px-6 py-3 font-srcond text-sm uppercase tracking-wider text-sr-surface transition-transform duration-200 ease-sr hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:rounded-md lg:bg-transparent lg:px-0 lg:py-2 lg:text-sr-ink2 lg:underline lg:decoration-sr-soft lg:underline-offset-4 lg:transition-colors lg:hover:translate-y-0 lg:hover:text-sr-ink lg:hover:decoration-sr-ink";

export const tabId = (tab: NetworkTab) => `sr-tab-${tab}`;
export const panelId = (tab: NetworkTab) => `sr-panel-${tab}`;

type NetworkTabsProps = { tab: NetworkTab; onTab: (tab: NetworkTab) => void };

// Below lg: a solid dock, icon above label, with the safe-area inset. From lg: plain text tabs in the top bar, no icons.
// The selected one is ink with a 2 px underline. Left and Right wrap, Home and End jump,
// and focus follows the selection so the arrow keys keep working.
export function NetworkTabs({ tab, onTab }: NetworkTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = NETWORK_TABS.indexOf(tab);
    const last = NETWORK_TABS.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (target < 0) return;
    event.preventDefault();
    onTab(NETWORK_TABS[target]);
    requestAnimationFrame(() => document.getElementById(tabId(NETWORK_TABS[target]))?.focus({ preventScroll: true }));
  };
  return (
    <div role="tablist" aria-label={copy.tabsLabel} onKeyDown={onKeyDown} className="relative z-10 grid grid-cols-4 gap-1 border-t border-sr-soft bg-sr-surface px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 [grid-area:tabs] max-lg:short-landscape:sticky max-lg:short-landscape:bottom-0 lg:ml-4 lg:flex lg:items-center lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0">
      {NETWORK_TABS.map((id) => {
        const selected = id === tab;
        const Icon = ICONS[id];
        return (
          <button
            key={id}
            id={tabId(id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onTab(id)}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 font-srcond text-xs uppercase tracking-wider transition-colors lg:flex-row lg:rounded-none lg:border-b-2 lg:px-3 lg:py-2 lg:text-sm duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
              selected ? "bg-sr-ink text-sr-surface lg:border-sr-ink lg:bg-transparent lg:text-sr-ink" : "text-sr-ink hover:bg-sr-strong lg:border-transparent lg:text-sr-ink2 lg:hover:bg-transparent lg:hover:text-sr-ink"
            }`}
          >
            <Icon aria-hidden="true" size={18} className="lg:hidden" />
            {copy.tabs[id]}
          </button>
        );
      })}
    </div>
  );
}
