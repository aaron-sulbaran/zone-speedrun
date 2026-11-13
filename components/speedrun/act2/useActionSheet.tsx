"use client";

import { useState, type Dispatch } from "react";
import type { Action } from "@/lib/speedrun/actions";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { ActionSheet } from "./ActionSheet";

type Opened = { action: Action; opener: HTMLButtonElement; scope: Element | null };

/**
 * Opening a sheet, confirming it and showing the result, for any place on the Board that starts an action.
 * Every entrance shares `state.done`, so a decision made in the brief or the table shows everywhere.
 * Elements marked `data-done-scope` hold their own done marker, which is where focus lands after a confirm.
 */
export function useActionSheet(state: Pick<DemoState, "done" | "shortlist" | "picked">, dispatch: Dispatch<DemoAction>) {
  const [open, setOpen] = useState<Opened | null>(null);

  const confirm = (id: string, time?: string) => {
    if (!open) return;
    dispatch({ type: "markDone", id, slot: time });
    if (open.action.matchKey) dispatch({ type: "bringForward", key: open.action.matchKey, on: true });
    setOpen(null);
  };
  // The opener while it is still on the page; after a confirm it has been swapped for its scope's done marker, which takes focus.
  const returnFocus = () => {
    if (!open) return null;
    return open.scope?.querySelector<HTMLElement>("[data-action-done]") ?? (open.opener.isConnected ? open.opener : null);
  };

  return {
    isDone: (action: Action) => (action.matchKey ? state.shortlist.includes(action.matchKey) : state.done.includes(action.id)),
    pickedFor: (action: Action) => state.picked[action.id],
    onOpen: (action: Action, opener: HTMLButtonElement) => setOpen({ action, opener, scope: opener.closest("[data-done-scope]") }),
    sheet: <ActionSheet action={open?.action ?? null} onConfirm={confirm} onClose={() => setOpen(null)} returnFocus={returnFocus} />,
  };
}
