import { speedrunCopy } from "@/lib/content";
import type { InboxEvent } from "@/lib/speedrun/types";

const copy = speedrunCopy.board;

export function TodayCard({ events }: { events: InboxEvent[] }) {
  return events.length === 0 ? (
    <p className="text-sm text-sr-ink2">{copy.today.empty}</p>
  ) : (
    <ul data-today-list="" className="space-y-2 text-sm">
      {events.slice(0, 6).map((event) => (
        <li key={event.emailId}>{copy.today.item(copy.kindLabels[event.kind], event.company)}</li>
      ))}
    </ul>
  );
}

export function IntrosCard({ events }: { events: InboxEvent[] }) {
  return events.length === 0 ? (
    <p className="text-sm text-sr-ink2">{copy.intros.empty}</p>
  ) : (
    <ul data-intros-list="" className="space-y-2 text-sm">
      {events.slice(0, 6).map((event) => (
        <li key={event.emailId}>{copy.intros.item(event.company)}</li>
      ))}
    </ul>
  );
}
