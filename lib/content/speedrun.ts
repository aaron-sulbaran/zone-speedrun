// Copy for /speedrun, a concept page for the speedrun talent team. Sections
// beyond meta, affiliation and logoAlt are filled in by later tasks.

export const speedrunCopy = {
  meta: {
    title: "a concept for the speedrun talent team · Aaron Sulbaran",
    description:
      "What joining the speedrun talent network could give you on day one: a concept and working demo by Aaron Sulbaran.",
  },
  affiliation: "A concept by Aaron Sulbaran for the speedrun talent team. Not affiliated.",
  logoAlt: "a16z speedrun",
  act1: {
    kicker: "For the a16z speedrun talent team",
    headline1: "job hunting sux.",
    headline2: "I've been in the loop.",
    p1: "I love your approach to helping people find jobs. It's like working for a startup that helps people find their startups, whether that's building their own or working for one. Thinking like a founder, as if you're in a startup yourself, is the best way to help someone who wants to learn about startups. That's a special thing.",
    p2: "So why take the time to do this? One, it's fun. Two, I want to get involved in the startup space, and there's no better way than to understand it so well that you can help others break into it too.",
    p3: "Which brings me to job hunting sux. Why has it been so hard to find a job? Sometimes it's just not fun. It's an endless loop, and I've been in it. Or I'm lucky enough to land an interview and realize I hate the process. That's something you're tackling at speedrun, and it's something I'd love to tackle with you.",
    funnelKicker: "My fall search",
    funnelCaption: "From the job search dashboard I built for myself. Numbers nudged for privacy, and no company names.",
    stats: [
      { key: "applications", label: "applications", value: 84 },
      { key: "assessments", label: "assessments", value: 15 },
      { key: "interviews", label: "interviews", value: 8 },
      { key: "intros", label: "founder intros through your team", value: 2 },
    ],
    flowTitle: "My fall search as a flow from applications to offers",
    lanes: { internship: "Internship", coop: "Co-op", fulltime: "Full-time", fellowship: "Fellowship" },
    rowsLabel: "A few rows from the dashboard",
  },
  shift: {
    turnLine1: "I'm not building this for me.",
    turnLine2: "I'm building it for y'all. So it should look like y'all.",
    button: "Build it in y'all's style",
    replay: "Replay the shift",
    line: "okay. y'all's style.",
  },
  hero: {},
  join: {},
  build: {},
  matches: {},
  board: {},
  brief: {},
  decisions: {},
  close: {},
  flow: {
    lanes: { jobs: "Job search", founder: "Founder lane" },
    hub: "Applications",
    stages: {
      applied: "Applied",
      assessment: "Assessment",
      screen: "Screen",
      interview: "Interview",
      offer: "Offer",
    },
    exits: { rejected: "Rejected", noreply: "No reply", open: "Still open" },
    tableHead: { step: "Step", count: "Applications" },
  },
  people: {
    maya: {
      name: "Maya",
      line: "Sophomore in CS, looking for a summer 2027 software internship, five applications in.",
      mode: "Depth",
    },
    ravi: {
      name: "Ravi",
      line: "New grad AI engineer, sixty applications out, hoping for an applied AI team.",
      mode: "Matches",
    },
    sam: {
      name: "Sam",
      line: "Senior in ECE and product engineer, co-op or new grad, ninety applications and two founder intros.",
      mode: "Pipeline",
    },
    lena: {
      name: "Lena",
      line: "Product designer two years in, forty applications, leading with her portfolio.",
      mode: "Matches",
    },
    dev: {
      name: "Dev",
      line: "Laid off from a big-tech infra team, built two side companies, five hundred touches across jobs, accelerators and funds.",
      mode: "Triage",
    },
  },
};
