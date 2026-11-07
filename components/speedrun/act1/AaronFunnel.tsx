import { speedrunCopy } from "@/lib/content";
import { aaronFlow, aaronSampleRows } from "@/lib/speedrun/aaronMock";
import { FlowChart } from "../FlowChart";

// Aaron's own search, drawn from the job search dashboard he built for himself:
// stat tiles, the flow chart, three anonymized rows and a privacy caption.

export function AaronFunnel() {
  const copy = speedrunCopy.act1;
  const flow = speedrunCopy.flow;
  const { detail, status } = copy.rowSeparators;
  return (
    <section aria-labelledby="aaron-funnel" className="mt-24 max-w-5xl rounded-3xl border border-border bg-glass p-6 md:p-10">
      <h2 id="aaron-funnel" className="font-label text-label-sm uppercase text-muted">
        {copy.funnelKicker}
      </h2>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {copy.stats.map((stat) => (
          <div key={stat.key} className="flex flex-col-reverse justify-end gap-2">
            <dt className="font-label text-label-sm text-muted">{stat.label}</dt>
            <dd data-funnel-stat={stat.key} className="font-display text-display-sm leading-none text-foreground">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-10">
        <FlowChart data={aaronFlow()} tone="aaron" title={copy.flowTitle} animate />
      </div>
      <h3 className="mt-10 font-label text-label-sm uppercase text-muted">{copy.rowsLabel}</h3>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {aaronSampleRows().map(({ row, track }) => (
          <li key={`${row.company}-${row.role}-${row.furthest}-${row.exit}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <span className="text-foreground">
              {row.company}
              <span className="text-muted">
                {" "}
                {row.role}
                {detail}
                {copy.lanesInline[track]}
              </span>
            </span>
            <span className="font-label text-label-sm text-foreground">
              {flow.stages[row.furthest]}
              {row.furthest !== "offer" && (
                <span className="text-muted">
                  {status}
                  {flow.exits[row.exit]}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">{copy.funnelCaption}</p>
    </section>
  );
}
