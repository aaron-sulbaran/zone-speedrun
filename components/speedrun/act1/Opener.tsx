import { speedrunCopy } from "@/lib/content";

// Aaron's opener: the kicker, the two-line headline, three paragraphs.

export function Opener() {
  const copy = speedrunCopy.act1;
  return (
    <header className="max-w-3xl">
      <p className="font-label text-label-sm uppercase text-muted">{copy.kicker}</p>
      <h1 data-phase-heading="" tabIndex={-1} className="focus:outline-none mt-6 font-display text-display-sm text-foreground">
        <span className="block">{copy.headline1}</span>
        <span className="block text-muted">{copy.headline2}</span>
      </h1>
      <div className="mt-12 space-y-6 text-lg leading-relaxed text-foreground md:text-body-lg">
        <p>{copy.p1}</p>
        <p>{copy.p2}</p>
        <p>{copy.p3}</p>
      </div>
    </header>
  );
}
