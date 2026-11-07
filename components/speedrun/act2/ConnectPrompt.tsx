import { speedrunCopy } from "@/lib/content";

export function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  const copy = speedrunCopy.board;
  return (
    <div data-connect-prompt="" className="rounded-2xl border border-sr-soft bg-sr-surface p-8 text-center md:p-12">
      <p className="mx-auto max-w-md text-2xl font-semibold leading-tight md:text-3xl">{copy.connectPrompt}</p>
      <button
        type="button"
        onClick={onConnect}
        className="mt-6 rounded-full bg-sr-ink px-6 py-3 font-srcond text-sm uppercase tracking-wider text-sr-surface transition-transform duration-200 ease-sr hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {copy.connectButton}
      </button>
    </div>
  );
}
