import { ArrowUpRight } from "lucide-react";
import { speedrunCopy } from "@/lib/content";
import type { PersonKey } from "@/lib/speedrun/types";

export function ToolsCard({ personKey }: { personKey: PersonKey | null }) {
  const { rows } = speedrunCopy.board.tools;
  const { newTab } = speedrunCopy;
  return (
    <ul data-tools-list="">
      {rows.map((row) => (
        <li key={row.key} className="border-t border-sr-soft first:border-0">
          <a
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby={`sr-tool-${row.key}-note`}
            className="group flex items-start justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple"
          >
            <span>
              <span className="block font-semibold">{row.name}</span>
              <span className="mt-0.5 block text-sm text-sr-ink2">{row.why[personKey ?? "default"]}</span>
            </span>
            <ArrowUpRight
              aria-hidden="true"
              size={18}
              className="mt-0.5 shrink-0 transition-transform duration-200 ease-sr group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
            />
          </a>
          <span id={`sr-tool-${row.key}-note`} hidden>
            {newTab}
          </span>
        </li>
      ))}
    </ul>
  );
}
