"use client";

import type { KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import { NETWORK_TABS, type NetworkTab } from "@/lib/speedrun/phase";

const copy = speedrunCopy.network;

export const tabId = (tab: NetworkTab) => `sr-tab-${tab}`;
export const panelId = (tab: NetworkTab) => `sr-panel-${tab}`;

type NetworkTabsProps = { tab: NetworkTab; onTab: (tab: NetworkTab) => void };

// Frosted pills; the selected one is black. Left and Right wrap, Home and End jump,
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
    <div role="tablist" aria-label={copy.tabsLabel} onKeyDown={onKeyDown} className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap gap-2">
      {NETWORK_TABS.map((id) => {
        const selected = id === tab;
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
            className={`rounded-full px-5 py-2.5 font-srcond text-sm uppercase tracking-wider backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none ${
              selected ? "bg-sr-ink text-sr-surface" : "bg-sr-hud text-sr-ink hover:bg-sr-strong"
            }`}
          >
            {copy.tabs[id]}
          </button>
        );
      })}
    </div>
  );
}
