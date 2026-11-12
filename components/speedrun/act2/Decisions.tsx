import { speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.decisions;

// Aaron's product decisions: nine cards, then what he would measure. Each card
// sits under a 2px black rule, like the trait columns on their application page.
export function Decisions() {
  return (
    <section data-decisions="" aria-labelledby="sr-decisions-heading" className="mx-auto w-full max-w-3xl lg:mx-0 lg:max-w-none">
      <p className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">{copy.eyebrow}</p>
      <h2 id="sr-decisions-heading" className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
        {copy.heading}
      </h2>
      <p data-why-refresher="" className="mt-4 max-w-xl text-lg leading-relaxed text-sr-ink2">
        {copy.refresher}
      </p>
      <ul className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2">
        {copy.cards.map((card) => (
          <li key={card.title} data-decision-card="" className="border-t-2 border-sr-ink pt-4">
            <h3 className="text-lg font-bold">{card.title}</h3>
            <p className="mt-2 text-sr-ink2">{card.body}</p>
          </li>
        ))}
      </ul>
      <h3 className="mt-16 font-srcond text-sm uppercase tracking-widest text-sr-ink2">{copy.measureHeading}</h3>
      <ul data-metrics="" className="mt-4 grid gap-x-8 gap-y-8 sm:grid-cols-2">
        {copy.metrics.map((metric) => (
          <li key={metric.label} className="border-t-2 border-sr-ink pt-4">
            <p className="font-bold">{metric.label}</p>
            <p className="mt-1 text-sm text-sr-ink2">{metric.line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
