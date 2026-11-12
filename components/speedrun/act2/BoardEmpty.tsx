import { speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.board.empty;
const LINK = "inline-flex min-h-11 items-center rounded-full px-1 font-semibold text-sr-ink underline underline-offset-4 hover:text-sr-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple";

type Props = {
  connected: boolean;
  onConnect: () => void;
  onMatches: () => void;
};

/** With no inbox and no sample person there is nothing to count: one line points to the two ways to fill the board. */
export function BoardEmpty({ connected, onConnect, onMatches }: Props) {
  return (
    <div data-board-empty="" className="rounded-2xl border border-sr-soft bg-sr-surface p-5 md:p-6">
      <p className="flex flex-wrap items-center text-base text-sr-ink">
        {connected ? (
          <>
            {copy.connectedBefore}
            <button type="button" data-empty-matches="" onClick={onMatches} className={LINK}>{copy.matches}</button>
            {copy.connectedAfter}
          </>
        ) : (
          <>
            {copy.before}
            <button type="button" data-empty-connect="" onClick={onConnect} className={LINK}>{copy.connect}</button>
            {copy.middle}
            <button type="button" data-empty-matches="" onClick={onMatches} className={LINK}>{copy.matches}</button>
            {copy.after}
          </>
        )}
      </p>
    </div>
  );
}
