import { ArrowUpRight } from "lucide-react";
import { siteContent, speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.close;
const LINKEDIN_HREF = siteContent.menu.socials.find((social) => social.key === "linkedin")?.href;
const NEW_TAB_NOTE_ID = "sr-close-newtab";
const LINKS = copy.links
  .map((link) => ({ ...link, href: link.href ?? LINKEDIN_HREF }))
  .filter((link): link is typeof link & { href: string } => Boolean(link.href));

// The way back to Aaron's site: a dark card at the end of the Why tab, with white text and links.
export function Close() {
  return (
    <footer data-close="" aria-labelledby="sr-close-heading" className="mx-auto mt-12 w-full max-w-3xl lg:mx-0 lg:max-w-none rounded-2xl bg-sr-ink px-6 py-10 text-sr-surface">
      <div>
        <h2 id="sr-close-heading" className="font-srcond text-sm font-normal uppercase tracking-widest">
          {copy.eyebrow}
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed">{copy.body}</p>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-1">
          {LINKS.map((link) => {
            const external = link.href.startsWith("http");
            return (
              <li key={link.key}>
                <a
                  href={link.href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer", "aria-describedby": NEW_TAB_NOTE_ID } : {})}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 font-srcond uppercase tracking-widest underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sr-surface"
                >
                  {link.label}
                  {external && <ArrowUpRight aria-hidden="true" size={14} />}
                </a>
              </li>
            );
          })}
        </ul>
        <span id={NEW_TAB_NOTE_ID} hidden>
          {speedrunCopy.newTab}
        </span>
        <p className="mt-10 font-srcond text-xs uppercase tracking-widest opacity-70">{speedrunCopy.affiliation}</p>
      </div>
    </footer>
  );
}
