export { speedrunCopy } from "./content/speedrun";

// Only the fields this app reads from the site's content: the site's name, the
// LinkedIn address (values as on the site), the skip link's label and the logo's
// label.
export const siteContent = {
  meta: {
    title: "Aaron Sulbaran",
    url: "https://aaronsulbaran.com",
  },
  skipLinkLabel: "Skip to content",
  logoAriaLabel: "aaronsulbaran.com home",
  menu: {
    socials: [{ key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/aaron-sulbaran/" }],
  },
};
