import { speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.network;
const TEXT_BUTTON = "font-srcond text-sm uppercase tracking-wider text-sr-ink2 underline-offset-4 transition-colors duration-200 hover:text-sr-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none";

type NetworkHeaderProps = { name: string; onStartOver: () => void; onReplayTop: () => void };

// The phase heading, the "built for you" tag, one line of orientation, and the two resets.
export function NetworkHeader({ name, onStartOver, onReplayTop }: NetworkHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-3xl flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        <p className="font-srcond text-sm uppercase tracking-widest text-sr-purple">{copy.tag}</p>
        <h2 data-phase-heading="" tabIndex={-1} className="mt-2 break-words text-3xl font-semibold leading-tight tracking-tight focus:outline-none md:text-5xl">
          {copy.heading(name)}
        </h2>
        <p className="mt-3 text-lg text-sr-ink2">{copy.next}</p>
      </div>
      <div className="flex gap-5">
        <button type="button" onClick={onStartOver} className={TEXT_BUTTON}>
          {copy.startOver}
        </button>
        <button type="button" onClick={onReplayTop} className={TEXT_BUTTON}>
          {copy.replayTop}
        </button>
      </div>
    </header>
  );
}
