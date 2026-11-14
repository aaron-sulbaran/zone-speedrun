import { speedrunCopy } from "@/lib/content";
import type { FounderRoute as Route } from "@/lib/speedrun/match";

const LINK =
  "inline-flex min-h-11 items-center rounded-full bg-sr-ink px-5 py-2.5 font-srcond text-sm uppercase tracking-wider text-sr-surface transition-transform duration-200 ease-sr hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function FounderRoute({ routes, mentioned = false }: { routes: Route[]; mentioned?: boolean }) {
  const copy = speedrunCopy.matches.founder;
  if (routes.length === 0) return null;
  return (
    <div data-founder-route="" className="rounded-xl border border-sr-soft bg-sr-surface p-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <h3 data-detail-heading="" tabIndex={-1} className="text-xl font-semibold leading-tight focus:outline-none md:text-2xl">
        {mentioned ? copy.mentioned : copy.heading}
      </h3>
      <p className="mt-2 max-w-xl text-sm text-sr-ink2">{mentioned ? copy.mentionedBody : copy.body}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {routes.map((route) => (
          <a key={route.kind} href={route.url} target="_blank" rel="noopener noreferrer" className={LINK}>
            {copy[route.kind]}
          </a>
        ))}
      </div>
    </div>
  );
}
