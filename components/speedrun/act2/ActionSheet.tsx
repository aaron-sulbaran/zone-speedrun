"use client";

import { speedrunCopy } from "@/lib/content";
import type { Action } from "@/lib/speedrun/actions";
import { ActionSheetBody } from "./ActionSheetBody";
import { useModalDialog } from "./useModalDialog";

type Props = { action: Action | null; onConfirm: (id: string) => void; onClose: () => void };

/** Every action in the product opens this one sheet; a sheet that is not open renders nothing. */
export function ActionSheet({ action, onConfirm, onClose }: Props) {
  return action ? <OpenSheet key={action.id} action={action} onConfirm={onConfirm} onClose={onClose} /> : null;
}

function OpenSheet({ action, onConfirm, onClose }: Omit<Props, "action"> & { action: Action }) {
  const ref = useModalDialog(onClose);
  return (
    <dialog
      ref={ref}
      data-action-sheet=""
      aria-labelledby="sr-sheet-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-sr-soft bg-sr-surface p-6 text-sr-ink shadow-[0_16px_56px_var(--sr-soft)] backdrop:bg-[color-mix(in_srgb,var(--sr-ink)_40%,transparent)] sm:p-8"
    >
      <ActionSheetBody sheet={action.sheet} ui={speedrunCopy.actions.sheetUi} onConfirm={() => onConfirm(action.id)} onClose={() => ref.current?.close()} />
    </dialog>
  );
}
