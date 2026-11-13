import { speedrunCopy } from "@/lib/content";
import { INLINE_LINK } from "./links";

const copy = speedrunCopy.board.empty;

type Props = {
  connected: boolean;
  onConnect: () => void;
  onMatches: () => void;
};

/** With no inbox and no sample person there is nothing to count: one line points to the two ways to fill the board. */
export function BoardEmpty({ connected, onConnect, onMatches }: Props) {
  return (
    <div data-board-empty="" className="rounded-2xl border border-sr-soft bg-sr-surface p-5 md:p-6">
      <p className="text-base text-sr-ink">
        {connected ? (
          <>
            {copy.connectedBefore}
            <button type="button" data-empty-matches="" onClick={onMatches} className={INLINE_LINK}>{copy.matches}</button>
            {copy.connectedAfter}
          </>
        ) : (
          <>
            {copy.before}
            <button type="button" data-empty-connect="" onClick={onConnect} className={INLINE_LINK}>{copy.connect}</button>
            {copy.middle}
            <button type="button" data-empty-matches="" onClick={onMatches} className={INLINE_LINK}>{copy.matches}</button>
            {copy.after}
          </>
        )}
      </p>
    </div>
  );
}
