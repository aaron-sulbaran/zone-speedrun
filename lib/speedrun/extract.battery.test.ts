import { describe, expect, it } from "vitest";
import { extractProfile } from "./extract";
import type { Intake, Profile } from "./types";

// A regression battery for the resume reader: every founder and seniority phrasing a
// reviewer used, with its expected reading, so a fix for one round cannot quietly undo
// another. Add a row for every new miss. The source column names the review round
// (r1 to r5, with the finding where there was one). People, schools' clubs and companies
// are made up; only the accelerators and funds a founder would name (YC, a16z speedrun,
// Techstars) are real. A fifth column of true marks a row that fails today (it.fails).

const intake: Intake = { targets: ["engineering"], places: ["Remote"], why: "" };

// "routes" means a founder score of 0.6 or more: the visitor sees the speedrun and alpha
// applications. The text is everything after the name line.
type Routes = "routes" | "no routes";
type FounderRow = [source: string, expected: Routes, text: string, red?: true];

const FOUNDER: FounderRow[] = [
  // Real founders.
  ["r3 F1", "routes", "Co-founded Acme AI (YC W25), raised $3M seed"],
  ["r3 F1", "routes", "Co-founded an ML infra startup; went through Y Combinator"],
  ["r3 F1", "routes", "Co-founded Acme AI; went through the Larkspur accelerator"],
  ["r3 I3", "routes", "Founder & CEO, Acme AI (YC W25)\nRaised a $3M seed round"],
  ["r3 I3", "routes", "Founder, Acme (YC S24)\n- Raised $1.5M pre-seed"],
  ["r3 I3", "routes", "CEO and Founder, Acme\nRaised $4M seed from a16z"],
  ["r4", "routes", "Acme | Founder\nRaised $2M seed"],
  ["r4", "routes", "Acme | Founder | 2021 to 2023\nRaised a $2M seed round"],
  ["r4", "routes", "Founder\nAcme, 2021 to 2024\n- Raised $1M seed"],
  ["r1", "routes", "Raised $2 million in a seed round\nRaised $1.5M from angels\nRaised a pre-seed round"],
  ["r1", "routes", "Co-founded Acme, grew the team to 12\nSolo founder of Beta\nFounded Gamma, a payments company"],
  ["r5 N1", "routes", "Founder & CEO, Acme AI (YC W25), team of 6\nRaised a $3M seed round", true],
  ["r5 N1", "routes", "Founder & CEO, Acme (YC W25) - led a team of 8\n- Raised a $3M seed round", true],
  ["r5 N1", "routes", "Founder, Acme (accepted into YC's S24 program)\n- Raised $1.5M pre-seed", true],
  ["r5 N1", "routes", "Founder & CEO, Acme (a16z speedrun program)\n- Raised $2M seed", true],
  ["r5 N1", "routes", "Founder, Acme (Techstars program, 2023)\n- Raised $1.2M seed", true],
  ["r5 N1", "routes", "Founder & CEO, Acme, a platform for hackathon organizers\n- Raised $1M pre-seed", true],
  ["r5 N1", "routes", "Founder & CEO, Acme\n- Raised $2M seed from angels and a corporate sponsor", true],
  ["r5 N1", "routes", "Founder & CEO, Acme\n- Raised $2M seed; sponsors include a16z scouts", true],
  ["r5", "routes", "Founder & CEO, Acme, software for nonprofit organizations\n- Raised $2M seed"],
  ["r5", "routes", "Founder & CEO, Teamwork AI\n- Raised a $2M seed round"],
  ["r5", "routes", "Founder & CEO, Acme (YC W25)\n- Raised a $3M seed round, hired a team of 6"],
  ["r5", "routes", "Co-founded Acme with my team from school\n- Raised a $1M pre-seed"],
  ["r5", "routes", "Co-founder & CTO, Acme (YC W24)\n- Built the engineering team from 0 to 9\n- Raised a $4M seed"],
  ["r5", "routes", "Founder, Acme (YC S24)\n- Raised $1.5M pre-seed\n- Built the team to 5 engineers"],
  ["r3 M6", "routes", "Founded a startup with a team of four engineers\n- Raised a $1M pre-seed"],
  // Real founders, as whole resumes (r5 founders probe).
  ["r5 N1 resume", "routes", "EXPERIENCE\nFounder & CEO, Acme (team of 6), 2023 to present\n- Built a payments API used by 40 merchants\n- Raised a $2M seed from angels\n- Hired the first five engineers\nSoftware Engineer, Oakhaven Pay, 2020 to 2023\n- Owned the refunds service", true],
  ["r5 N1 resume", "routes", "EXPERIENCE\nFounder & CEO, Acme (a16z speedrun program), 2024 to present\n- Built a scheduling tool for dental clinics; 30 paying clinics\n- Raised a $1.5M pre-seed\nSoftware Engineer, Northpier, 2021 to 2024\n- Built card controls", true],
  ["r5 resume", "routes", "EXPERIENCE\nFounder, Acme (YC S24 program), 2024 to present\n- Shipped an AI tutor used by 12 schools\n- Raised a $1.5M pre-seed from YC and angels\nEngineer, Larchmont Labs, 2021 to 2024"],
  ["r5 N1 resume", "routes", "EXPERIENCE\nFounder & CEO, Acme, 2022 to present\n- Raised $3M seed from angels and a corporate sponsor\n- Grew revenue to $40k MRR\nProduct Manager, Fernwick, 2019 to 2022", true],
  ["r5 N1 resume", "routes", "EXPERIENCE\nFounder & CEO, Gatherly, a hackathon platform, 2022 to present\n- Raised $2M seed\n- 200 company customers\nEngineer, Ashgrove Software, 2018 to 2022", true],

  // Student groups: founding a club, team, hackathon or program is not founding a company.
  ["r4 I1", "no routes", "Founder & President, Longhorn Robotics Team\nRaised $8k in sponsorships"],
  ["r4 I1", "no routes", "Founder & President, Longhorn Robotics Team\n- Raised $8k in sponsorships"],
  ["r4 I1", "no routes", "Founder and President, Texas Robotics Team\n- Raised $5k in sponsorships from local companies"],
  ["r4 I1", "no routes", "Founder, HackUT (student hackathon)\nRaised $20k from sponsors"],
  ["r4 I1", "no routes", "Founder, Women in CS Mentorship Program\nRaised $3k"],
  ["r5", "no routes", "Founder, Women in CS Mentorship Program\n- Raised $3k from local companies"],
  ["r4 I1", "no routes", "Founded the Startup Club at UT\nRaised $4k from sponsors"],
  ["r4 I1", "no routes", "Founded the Startup Club at UT\nBrought YC founders to campus"],
  ["r4 I1", "no routes", "Founded the Startup Club at UT\n- Brought YC founders to campus for talks"],
  ["r4 I1", "no routes", "Co-founded a student startup club"],
  ["r4 I1", "no routes", "Founded a Business Club"],
  ["r4", "no routes", "Founded the Startup Club"],
  ["r5", "no routes", "Founded a student organization for first-generation engineers"],
  ["r4", "no routes", "Founder & President, AI Club\n- Raised $5k in sponsorships"],
  ["r5 R-a", "no routes", "Co-founder & President, Women in CS Club\n- Raised $3k from local companies", true],
  ["r5 R-a", "no routes", "Co-founder, HackUT, a student hackathon\n- Raised $20k from 12 companies", true],
  ["r5 R-a", "no routes", "Co-founder, HackUT, a student hackathon\n- Raised $20k from sponsors"],
  ["r5 R-a", "no routes", "Co-founder, HackRiver, the largest student hackathon in Texas\n- Raised $60k from 30 companies", true],
  ["r5 R-a resume", "no routes", "EDUCATION\nUT Austin, BS CS 2027\nLEADERSHIP\nCo-founder & President, Women in CS Club\n- Raised $3k from local companies\n- Grew to 120 members", true],
  ["r5 R-a resume", "no routes", "EDUCATION\nUT Austin, BS CS 2027\nLEADERSHIP\nCo-founder, HackUT, a student hackathon\n- Raised $20k from 12 companies", true],
  ["r5 R-a resume", "no routes", "EDUCATION\nUT Austin, BS CS 2028\nEXPERIENCE\nSoftware Engineering Intern, Pinewick, May 2026 to Aug 2026\n- Built internal tools in React\nLEADERSHIP\nCo-founder & President, Women in CS Club\n- Raised $3k from local companies\nSKILLS\nPython, React, TypeScript", true],
  ["r5", "no routes", "Co-founded the UT Blockchain Society\n- Raised $10k"],
  ["r5", "no routes", "Started a robotics team at my high school\n- Raised $2k for parts"],
  ["r5", "no routes", "Founder, Longhorn Startup Club\n- Accepted 40 members into the YC Startup School cohort"],
  ["r1", "no routes", "Founder, Robotics Club"],
  ["r1", "no routes", "Founded the robotics club, 40 members"],
  ["r3", "no routes", "Founded the Texas Robotics Team"],

  // Earlier over-firing: charity money, hardware accelerators, titles near a founder.
  ["r1", "no routes", "Raised 4,000 dollars for the food bank"],
  ["r3", "no routes", "Raised $4,000 for the food drive"],
  ["r3", "no routes", "Raised $50k for Hearthstone Homes"],
  ["r3", "no routes", "Raised a seed round to drive growth"],
  ["r1", "no routes", "Built a detector at the particle accelerator lab"],
  ["r1", "no routes", "Founded the robotics club\nRaised 4,000 dollars for the food bank\nParticle accelerator lab"],
  ["r1", "no routes", "Built an FPGA accelerator for CNN inference\nTuned GPU accelerators for ML training\nRaised $4,000 for the food bank\nRaised $2,500 for the food bank\nRaised $1,000 for the food bank"],
  ["r3", "no routes", "Built an FPGA accelerator and a GPU accelerator for ML accelerators work"],
  ["r3", "no routes", "Designed an ML accelerator for edge inference"],
  ["r3", "no routes", "Built a neural network accelerator on FPGA"],
  ["r3", "no routes", "Research assistant at the linear accelerator lab"],
  ["r3 M6", "no routes", "Founded a startup with a team of four engineers"],
  ["r3 M6", "no routes", "Co-founded Acme with my team from school"],
  ["r4", "no routes", "Founder side project: Quietcoach"],
  ["r4", "no routes", "Founder-in-Residence, Acme Ventures"],
  ["r4", "no routes", "Executive Assistant to the Founder, Acme"],
  ["r4", "no routes", "Chief of Staff, Founder's Office, Acme"],
  ["r4", "no routes", "Teaching Assistant - Founder Studio"],
  ["r4", "no routes", "Product Lead - Founder Office, Acme\n- Raised $2M with the founders"],
];

// Seniority rows read the visitor's why against a short resume. "student line" puts the
// phrase on the resume instead, as a closing line.
const RESUMES = {
  student: "Ana\nEDUCATION\nUT Austin, BS CS 2028",
  grad: "Ana\nEDUCATION\nUT Austin, BS CS 2026",
  staff: "Ana\nEXPERIENCE\nStaff Software Engineer, Pinewick, 2018 to present",
};
type Who = keyof typeof RESUMES | "student line";
type SeniorityRow = [source: string, who: Who, phrase: string, expected: Profile["seniority"], red?: true];

const SENIORITY: SeniorityRow[] = [
  // Intern seekers.
  ["r3 F2", "student", "Looking for a software engineering intern role", "intern"],
  ["r3 F2", "student", "Seeking SWE intern positions for summer", "intern"],
  ["r3 F2", "student", "An intern role on a small team", "intern"],
  ["r3 F2", "student", "A summer internship", "intern"],
  ["r3 F2", "student", "Internship in ML", "intern"],
  ["r3 F2", "student", "I'd love to be an intern", "intern"],
  ["r3 F2", "student", "Intern, summer 2027", "intern"],
  ["r3 F2", "student line", "Looking for a software engineering intern role", "intern"],
  ["r3 F2", "student line", "Seeking SWE intern positions for summer", "intern"],
  ["r3 F2", "student line", "I'm looking for an internship", "intern"],
  ["r3 F2", "student line", "Open to internships", "intern"],
  ["r4 I2", "student", "After junior year I want an internship", "intern"],
  ["r4 I2", "student", "Summer after sophomore year: software internship", "intern"],
  ["r4 I2", "student", "Looking for a summer internship program", "intern"],
  ["r4 I2", "student", "Applying to your internship program for summer 2027", "intern"],
  ["r4", "student", "After my sophomore year I want a software internship", "intern"],
  ["r4", "student", "Looking for an internship program in software", "intern"],
  ["r4", "student", "Seeking the Summer 2027 internship at a startup", "intern"],
  ["r4", "student", "Open to internships", "intern"],
  ["r4", "student", "Looking for an internship; past internships at Pinewick", "intern"],
  ["r4", "student", "I was an intern at Pinewick last summer and want another internship", "intern"],
  ["r4", "student", "Previously interned at Pinewick; want a software internship", "intern"],
  ["r4", "student", "I want mentorship and an internship", "intern"],
  ["r4", "student", "Looking to be mentored in an internship", "intern"],
  ["r5", "student", "An internship with good mentorship", "intern"],
  ["r5", "student", "An internship where I get mentored", "intern"],
  ["r5", "student", "An internship with training and mentoring", "intern"],
  ["r5", "student", "Getting coached in an internship", "intern"],
  ["r5", "student", "After finals, a summer internship", "intern"],
  ["r5", "student", "After graduating high school I want an internship", "intern"],
  ["r5", "student", "Intern role for summer 2027, after my second year", "intern"],
  ["r5", "student", "Looking for an intern program at a startup", "intern", true],
  ["r5", "student", "The intern role at a small team", "intern", true],
  ["r5", "student", "Coaching and an internship", "intern", true],
  ["r5", "student", "Leadership growth in an internship", "intern", true],
  ["r5", "student", "An internship with hands-on coaching", "intern"],
  ["r5", "student", "Advice and an internship", "intern"],
  ["r5", "student", "A team that hires interns", "intern", true],
  ["r5", "student", "Companies that hire interns", "intern", true],
  ["r5", "student", "Internships at companies that hire interns", "intern"],
  ["r5", "student", "A startup that trains interns well", "intern", true],
  ["r5", "student", "Looking for a team that mentors interns", "intern", true],
  ["r5", "student", "An internship after junior year", "intern"],
  ["r5", "student", "Software internship after my sophomore year", "intern"],
  ["r5", "student", "Looking for an internship after spring semester", "intern"],
  ["r5", "student", "After two years of school, an internship", "intern"],
  ["r5 R-b", "student", "After junior year I want internships", "intern", true],
  ["r5 R-b", "student", "After sophomore year I'm applying to internships", "intern", true],
  ["r5 R-b", "student", "Summer after junior year: software internships", "intern", true],
  ["r5 R-b", "student", "After finals I'm looking at internships", "intern", true],

  // New grads, including those who want full-time after an internship.
  ["r3 I2", "grad", "A new grad role; I was an intern at Acme last summer", "new_grad"],
  ["r3 I2", "grad", "Looking for a new grad role after two internships", "new_grad"],
  ["r3", "grad", "New grad SWE, three internships behind me", "new_grad"],
  ["r5 N2", "grad", "Full-time SWE role after my internship at Pinewick", "new_grad", true],
  ["r5 N2", "grad", "A full-time role after my internship", "new_grad", true],
  ["r5 N2", "grad", "After my internship at Pinewick I want a full-time role", "new_grad", true],
  ["r5 N2", "grad", "Full-time after my summer internship", "new_grad", true],
  ["r5 N2", "grad", "Something full-time after my internship ends", "new_grad", true],
  ["r5 N2", "grad", "Return offer after my internship fell through", "new_grad", true],
  ["r5", "grad", "After two internships, a full-time role", "new_grad", true],
  ["r5 N4", "grad", "Companies that hire new grads", "new_grad", true],
  ["r5 N4", "grad", "A team that is good to new grads", "new_grad", true],
  ["r5 N4", "grad", "A company that invests in early career engineers like me", "new_grad", true],
  ["r5 N4", "grad", "Open to roles for new grads", "new_grad", true],
  ["r5 N4", "grad", "New grads welcome roles, backend", "new_grad", true],
  ["r5", "grad", "Early career engineer role", "new_grad"],
  ["r5", "grad", "An early career role in backend", "new_grad"],

  // Staff who mentor, hire or run programs for interns and new grads.
  ["r3 F2", "staff", "I want to mentor an intern", "senior"],
  ["r3 F2", "staff", "I managed interns last summer", "senior"],
  ["r3 F2", "staff", "Mentored three interns", "senior"],
  ["r3 F2", "staff", "Hired and onboarded 4 interns", "senior"],
  ["r3 F2", "staff", "Led a team of interns", "senior"],
  ["r3 F2", "staff", "I want to lead interns again", "senior"],
  ["r3 F2", "staff", "Supervised the intern program", "senior"],
  ["r3 F2", "staff", "Hiring interns for my team", "senior"],
  ["r3 I2", "staff", "Ran the intern program", "senior"],
  ["r3 I2", "staff", "Taught interns", "senior"],
  ["r3 I2", "staff", "Working with interns", "senior"],
  ["r3 I2", "staff", "I want to help interns grow", "senior"],
  ["r3 I2", "staff", "Built the intern onboarding", "senior"],
  ["r4", "staff", "Hire and train interns", "senior"],
  ["r4", "staff", "Mentor new grads on a small team", "senior"],
  ["r4", "staff", "A team that hires early career engineers", "senior"],
  ["r4", "staff", "Ran the intern program and mentored new grads", "senior"],
  ["r5 N3", "staff", "Ran the internship program", "senior", true],
  ["r5 N3", "staff", "I run the internship program at Pinewick", "senior", true],
  ["r5 N3", "staff", "Built our internship program from scratch", "senior", true],
  ["r5 N3", "staff", "Started the internship program", "senior", true],
  ["r5 N3", "staff", "Supporting the internship program", "senior", true],
  ["r5 N3", "staff", "Owned the internship program", "senior", true],
  ["r5 N3", "staff", "A place where I can keep running the internship program", "senior", true],
  ["r5", "staff", "Mentoring new grads and interns", "senior"],
  ["r5", "staff", "I love working with new grads", "senior"],
  ["r5", "staff", "Grow new grad engineers into leads", "senior"],
  ["r5", "staff", "A team with new grad hires I can mentor", "senior"],
  ["r5", "staff", "Mentor early career folks", "senior"],
  ["r5", "staff", "Help new grads ramp up", "senior"],
  ["r5", "staff", "Hiring new grads", "senior"],
  ["r5", "staff", "I want to coach new grad engineers", "senior"],
  ["r5", "staff", "A team that hires interns", "senior"],
];

describe("founder battery", () => {
  for (const [source, expected, text, red] of FOUNDER) {
    const test = red ? it.fails : it;
    test(`${source} | ${expected} | ${JSON.stringify(text)}`, () => {
      const { score } = extractProfile(`Ana\n${text}`, intake).founderSignal;
      if (expected === "routes") expect(score).toBeGreaterThanOrEqual(0.6);
      else expect(score).toBeLessThan(0.6);
    });
  }
});

describe("seniority battery", () => {
  for (const [source, who, phrase, expected, red] of SENIORITY) {
    const test = red ? it.fails : it;
    test(`${source} | ${who} | ${expected} | ${phrase}`, () => {
      const line = who === "student line";
      const resume = line ? `${RESUMES.student}\n${phrase}` : RESUMES[who];
      expect(extractProfile(resume, { ...intake, why: line ? "" : phrase }).seniority).toBe(expected);
    });
  }
});
