import { siteContent, speedrunCopy } from "@/lib/content";

const copy = speedrunCopy.close;
const LINKEDIN_HREF = siteContent.menu.socials.find((social) => social.key === "linkedin")?.href ?? "/";

// The way back to Aaron's site: a black band with white text and links.
export function Close() {
  return (
    <footer data-close="" className="bg-sr-ink px-6 py-16 text-sr-surface">
      <div className="mx-auto max-w-3xl">
        <p className="font-srcond text-sm uppercase tracking-widest">{copy.eyebrow}</p>
        <p className="mt-4 text-lg leading-relaxed">{copy.body}</p>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          {copy.links.map((link) => {
            const href = link.href ?? LINKEDIN_HREF;
            const external = href.startsWith("http");
            return (
              <li key={link.key}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="font-srcond uppercase tracking-widest underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sr-surface"
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
        <p className="mt-10 font-srcond text-xs uppercase tracking-widest opacity-70">{speedrunCopy.affiliation}</p>
      </div>
    </footer>
  );
}
