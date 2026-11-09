import { useEffect, useMemo } from "react";
import { createChoiceAdvance } from "@/lib/speedrun/choiceAdvance";

// Wraps the pure helper and cancels on unmount. `advance` should be stable
// (a useCallback), or the pending timer is dropped when it changes.
export function useChoiceAdvance(advance: () => void, delayMs: number) {
  const choice = useMemo(() => createChoiceAdvance(advance, delayMs), [advance, delayMs]);
  useEffect(() => choice.cancel, [choice]);
  return choice;
}
