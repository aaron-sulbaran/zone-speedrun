import { speedrunCopy } from "@/lib/content";
import type { PersonKey } from "@/lib/speedrun/types";

export function ToolsCard({ personKey }: { personKey: PersonKey | null }) {
  return (
    <ul data-tools-list="">
      {speedrunCopy.board.tools.rows.map((row) => (
        <li key={row.key} className="border-t border-sr-soft first:border-0">
          <a
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple"
          >
            <span>
              <span className="block font-semibold">{row.name}</span>
              <span className="mt-0.5 block text-sm text-sr-ink2">{row.why[personKey ?? "default"]}</span>
            </span>
            <span aria-hidden="true" className="mt-0.5 transition-transform duration-200 ease-sr group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
              &rarr;
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
