// Copy for /speedrun, a concept page for the speedrun talent team. Sections
// beyond meta, affiliation and logoAlt are filled in by later tasks.

import type { Fn } from "@/lib/speedrun/types";

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
  hero: {
    eyebrow: "Talent network \u00b7 a concept",
    headline: [{ text: "you joined. " }, { text: "now what", em: true }, { text: "?" }] as { text: string; em?: boolean }[],
    lede: "Today, joining gets you a confirmation and a week or two of quiet. Here, the network starts working the day you join: matches with reasons, a board built from your inbox, and a morning brief that only says what changed.",
    stats: {
      companies: "speedrun companies",
      roles: "live speedrun roles",
      snapshot: "snapshot of the jobs board",
    },
    cta: "Start the demo",
    ctaSecondary: "Skip to the dashboard",
  },
  join: {
    label: "Talent network \u00b7 Join",
    steps: {
      targets: { question: "What are you targeting?", helper: "Pick any that fit." },
      places: {
        question: "Where?",
        helper: "Pick places or type one. Remote counts.",
        inputLabel: "Add a place",
        inputPlaceholder: "Type a place and press Enter",
      },
      why: {
        question: "Why now, in a sentence?",
        placeholder: "I want to build with a founding team.",
        inputLabel: "Why now",
      },
      resume: {
        question: "Bring your resume, or borrow one.",
        helper: "Pick a sample person. Live reading of your own resume turns on soon.",
        uploadLabel: "Upload a resume",
        peopleLabel: "Sample people",
      },
    },
    back: "Back",
    next: "Continue",
    finish: "Build my board",
    pressEnter: "Press Enter",
    nothingSent: "Demo only: nothing you type here leaves this page.",
    connect: {
      gmail: "Connect Gmail",
      calendar: "Connect Calendar",
      connected: "Connected",
      connectNote:
        "In production this reads your inbox and calendar, read-only, and never sends as you. In this demo it loads the sample person's inbox.",
    },
    targetLabels: {
      engineering: "Software engineering",
      ai: "AI engineering",
      product: "Product",
      design: "Design",
      data: "Data",
      operations: "Operations",
      founder: "Founding",
    } as Record<Fn, string>,
    placeChips: ["Remote", "San Francisco", "New York", "Austin", "Los Angeles"],
    building: "Building your board.",
    ready: "Your board is ready.",
    error: "That did not load.",
    retry: "Try again",
    stepWord: "Step",
  },
  build: {},
  matches: {},
  board: {
    next: {
      applied: "Wait for a reply",
      assessment: "Finish the assessment",
      screen: "Prepare for the screen",
      interview: "Prepare for the interview",
      offer: "Decide on the offer",
    },
  },
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
