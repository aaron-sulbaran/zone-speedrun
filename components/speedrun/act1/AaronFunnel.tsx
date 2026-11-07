import { speedrunCopy } from "@/lib/content";
import { AARON_MOCK, AARON_ROW_TRACKS, aaronFlow } from "@/lib/speedrun/aaronMock";
import { FlowChart } from "../FlowChart";

// Aaron's own search, drawn from the job search dashboard he built for himself:
// stat tiles, the flow chart, three anonymized rows and a privacy caption.

function sampleRows() {
  const wanted = [
    (r: (typeof AARON_MOCK.rows)[number]) => r.furthest === "offer",
    (r: (typeof AARON_MOCK.rows)[number]) => r.furthest === "interview" && r.exit === "rejected",
    (r: (typeof AARON_MOCK.rows)[number]) => r.furthest === "screen" && r.exit === "open",
  ];
  const used = new Set<number>();
  return wanted.flatMap((test) => {
    const index = AARON_MOCK.rows.findIndex((row, i) => !used.has(i) && test(row));
    if (index < 0) return [];
    used.add(index);
    return [{ row: AARON_MOCK.rows[index], track: AARON_ROW_TRACKS[index] }];
  });
}

export function AaronFunnel() {
  const copy = speedrunCopy.act1;
  const flow = speedrunCopy.flow;
  return (
    <section aria-labelledby="aaron-funnel" className="mt-24 max-w-5xl rounded-3xl border border-border bg-glass p-6 md:p-10">
      <h2 id="aaron-funnel" className="font-label text-label-sm uppercase text-muted">
        {copy.funnelKicker}
      </h2>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {copy.stats.map((stat) => (
          <div key={stat.key}>
            <dd data-funnel-stat={stat.key} className="font-display text-display-sm leading-none text-foreground">
              {stat.value}
            </dd>
            <dt className="mt-2 font-label text-label-sm text-muted">{stat.label}</dt>
          </div>
        ))}
      </dl>
      <div className="mt-10">
        <FlowChart data={aaronFlow()} tone="aaron" title={copy.flowTitle} animate />
      </div>
      <h3 className="mt-10 font-label text-label-sm uppercase text-muted">{copy.rowsLabel}</h3>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {sampleRows().map(({ row, track }) => (
          <li key={`${row.company}-${row.role}-${row.furthest}-${row.exit}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <span className="text-foreground">
              {row.company}
              <span className="text-muted">
                {" "}
                {row.role}, {copy.lanes[track].toLowerCase()}
              </span>
            </span>
            <span className="font-label text-label-sm text-foreground">
              {flow.stages[row.furthest]}
              <span className="text-muted"> · {flow.exits[row.exit]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">{copy.funnelCaption}</p>
    </section>
  );
}
