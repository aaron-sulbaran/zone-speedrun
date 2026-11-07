import { describe, expect, it } from "vitest";
import { extractProfile } from "./extract";
import { PEOPLE } from "./people";
import type { PersonKey } from "./types";

const MAIN: Record<PersonKey, string> = {
  maya: "engineering",
  ravi: "ai",
  sam: "product",
  lena: "design",
  dev: "founder",
};

describe("extractProfile", () => {
  for (const key of Object.keys(PEOPLE) as PersonKey[]) {
    it(`reads ${key}'s resume and puts ${MAIN[key]} first`, () => {
      const person = PEOPLE[key];
      const profile = extractProfile(person.resumeText, person.intake);
      expect(profile.source).toBe("rules");
      expect(profile.functions[0]).toBe(MAIN[key]);
      expect(profile.firstName).toBe(person.profile.firstName);
      expect(profile.skills.length).toBeGreaterThan(2);
    });
  }

  it("scores Dev as a founder", () => {
    const dev = PEOPLE.dev;
    const profile = extractProfile(dev.resumeText, dev.intake);
    expect(profile.founderSignal.score).toBeGreaterThanOrEqual(0.6);
    expect(profile.founderSignal.evidence.length).toBeGreaterThan(0);
  });

  it("keeps the founder signal low for people who never started a company", () => {
    const maya = PEOPLE.maya;
    expect(extractProfile(maya.resumeText, maya.intake).founderSignal.score).toBeLessThan(0.4);
  });

  it("reads seniority from the text", () => {
    const seniority = (key: PersonKey) =>
      extractProfile(PEOPLE[key].resumeText, PEOPLE[key].intake).seniority;
    expect(seniority("maya")).toBe("intern");
    expect(seniority("ravi")).toBe("new_grad");
    expect(seniority("lena")).toBe("junior");
    expect(seniority("dev")).toBe("senior");
  });

  it("survives an empty resume", () => {
    const profile = extractProfile("", { targets: ["design"], places: ["Remote"], why: "" });
    expect(profile.functions).toEqual(["design"]);
    expect(profile.remoteOk).toBe(true);
  });

  const intake = { targets: ["engineering" as const], places: [], why: "" };
  const founderScore = (text: string) => extractProfile(text, intake).founderSignal.score;

  it("does not read a club, a food drive or a particle accelerator as a company", () => {
    expect(founderScore("Ana\nFounded the robotics club, 40 members")).toBeLessThan(0.6);
    expect(founderScore("Ana\nRaised 4,000 dollars for the food bank")).toBeLessThan(0.6);
    expect(founderScore("Ana\nBuilt a detector at the particle accelerator lab")).toBeLessThan(0.6);
    const all = "Ana\nFounded the robotics club\nRaised 4,000 dollars for the food bank\nParticle accelerator lab";
    expect(founderScore(all)).toBeLessThan(0.6);
  });

  it("never uses a section heading as founder evidence", () => {
    const dev = PEOPLE.dev;
    const { founderSignal } = extractProfile(dev.resumeText, dev.intake);
    expect(founderSignal.evidence.some((e) => /^FOUNDER WORK$/i.test(e))).toBe(false);
  });

  it("needs job-title context for senior", () => {
    const text = "Ana Lopez\nEXPERIENCE\nStaff writer, The Daily Texan, 2025 to present\nPROJECTS\nSenior software design project\nSKILLS\nPython";
    expect(extractProfile(text, intake).seniority).not.toBe("senior");
  });

  it("lets an explicit internship or new grad request win", () => {
    const text = "Ana\nEXPERIENCE\nSenior Software Engineer, Acme, 2018 to 2024\nLooking for a new grad program";
    expect(extractProfile(text, intake).seniority).toBe("new_grad");
  });

  it("reads mixed-case headings and variants", () => {
    const text = "Ana\nTechnical Skills\nPython, Go\nWork Experience\nSoftware Engineer, Acme, 2021 to 2024\nProjects\nTrailmap, Go";
    const profile = extractProfile(text, intake);
    expect(profile.skills).toEqual(["Python", "Go"]);
    expect(profile.shipped).toEqual(["Trailmap"]);
    expect(profile.headline).toBe("Software Engineer");
  });

  it("handles a short resume", () => {
    const profile = extractProfile("Jo\nbackend dev", { targets: ["engineering"], places: [], why: "" });
    expect(profile.firstName).toBe("Jo");
    expect(profile.functions.length).toBeGreaterThan(0);
  });

  it("handles a non-English resume and a non-ASCII name", () => {
    const text = "Jos\u00e9 Garc\u00eda\nM\u00e9xico | jose@example.com\n\nEXPERIENCIA\nIngeniero de software, Acme, 2022 a 2025\n\nHABILIDADES\nPython, SQL";
    const profile = extractProfile(text, { targets: ["engineering"], places: ["Remote"], why: "" });
    expect(profile.firstName).toBe("Jos\u00e9");
    expect(profile.skills).toEqual(["Python", "SQL"]);
    expect(profile.functions).toEqual(["engineering"]);
  });

  it("handles CRLF line endings", () => {
    const person = PEOPLE.lena;
    const crlf = person.resumeText.replace(/\n/g, "\r\n");
    const profile = extractProfile(crlf, person.intake);
    expect(profile.functions[0]).toBe("design");
    expect(profile.skills).toContain("Figma");
    expect(profile.firstName).toBe("Lena");
  });

  it("finds the city when the email comes first", () => {
    const text = "Ana Lopez\nana@example.com | (512) 555-0142 | github.com/ana | Austin, TX\nSKILLS\nPython";
    expect(extractProfile(text, intake).locations).toContain("Austin");
  });

  it("reads an inline Skills: line as the skills section", () => {
    const text = "Ana Lopez\nana@example.com\nSkills: TypeScript, Go, Postgres\nExperience\nBuilt a billing API.";
    expect(extractProfile(text, intake).skills).toEqual(["TypeScript", "Go", "Postgres"]);
  });

  it("finds the city on a plain second head line", () => {
    const text = "Ana Lopez\nAustin, TX\nana@example.com\nSKILLS\nPython";
    expect(extractProfile(text, intake).locations).toContain("Austin");
  });

  it("does not count hardware accelerators or a bare dollar sign", () => {
    const text = "Ana\nBuilt an FPGA accelerator for CNN inference\nTuned GPU accelerators for ML training\nRaised $4,000 for the food bank\nRaised $2,500 for the food bank\nRaised $1,000 for the food bank";
    expect(founderScore(text)).toBeLessThan(0.4);
    expect(founderScore("Ana\nRaised $2 million in a seed round\nRaised $1.5M from angels\nRaised a pre-seed round")).toBeGreaterThanOrEqual(0.6);
  });

  it("keeps a team grown inside a company from blocking founder evidence", () => {
    const text = "Ana\nCo-founded Acme, grew the team to 12\nSolo founder of Beta\nFounded Gamma, a payments company";
    const profile = extractProfile(text, intake);
    expect(profile.founderSignal.score).toBeGreaterThanOrEqual(0.6);
    expect(profile.founderSignal.evidence[0]).toContain("Acme");
  });

  it("keeps a closing paragraph out of the skills", () => {
    const text = "Ana\nSKILLS\nPython, Go\nLooking for a role where I can ship, learn and grow, with a great team.";
    expect(extractProfile(text, intake).skills).toEqual(["Python", "Go"]);
  });

  it("does not turn a senior into an intern because they want to mentor one", () => {
    const dev = PEOPLE.dev;
    const profile = extractProfile(dev.resumeText, { ...dev.intake, why: "Back to building, and I want to mentor an intern." });
    expect(profile.seniority).toBe("senior");
  });

  it("reads a decomposed name and rejects a headline as the city", () => {
    const text = "Jose\u0301 Ruiz\nProduct Designer | Design Systems\nSKILLS\nFigma";
    const profile = extractProfile(text, { targets: ["design"], places: [], why: "" });
    expect(profile.firstName).toBe("Jos\u00e9");
    expect(profile.locations).toEqual([]);
  });

  it("takes the city from a place-shaped segment only", () => {
    const text = "Ana\nProduct Designer | Brooklyn, NY | ana@example.com\nSKILLS\nFigma";
    expect(extractProfile(text, { targets: ["design"], places: [], why: "" }).locations).toEqual(["New York"]);
  });

  it("keeps founder routes for AI founders", () => {
    for (const line of ["Co-founded Acme AI (YC W25), raised $3M seed", "Co-founded an ML infra startup; went through Y Combinator"]) {
      expect(founderScore(`Ana\n${line}`), line).toBeGreaterThanOrEqual(0.6);
    }
    expect(founderScore("Ana\nBuilt an FPGA accelerator and a GPU accelerator for ML accelerators work")).toBeLessThan(0.4);
  });

  it("reads funding and growth wording", () => {
    expect(founderScore("Ana\nRaised a seed round to drive growth\nRaised $2M from angels")).toBeGreaterThanOrEqual(0.5);
    expect(extractProfile("Ana\nCo-founded Acme and grew the team to 12", intake).founderSignal.evidence[0]).toContain("Acme");
    expect(founderScore("Ana\nFounded the Texas Robotics Team")).toBeLessThan(0.3);
  });

  it("reads an intern role as an intern, and mentoring interns as nothing", () => {
    const seniorText = "Ana\nEXPERIENCE\nStaff Software Engineer, Acme, 2018 to present\n";
    for (const line of ["Looking for a software engineering intern role", "Seeking SWE intern positions for summer"]) {
      expect(extractProfile(`Ana\n${line}`, intake).seniority, line).toBe("intern");
    }
    expect(extractProfile("Ana", { ...intake, why: "An intern role on a small team" }).seniority).toBe("intern");
    for (const why of ["I want to mentor an intern", "I managed interns last summer"]) {
      expect(extractProfile(seniorText, { ...intake, why }).seniority, why).toBe("senior");
    }
  });

  it("keeps looking-for and open-to lines out of skills", () => {
    const text = "Ana\nSKILLS\nPython, Go\nI'm looking for a team that ships.\nOpen to relocation, remote work";
    expect(extractProfile(text, intake).skills).toEqual(["Python", "Go"]);
  });

  it("keeps what a project does, not only its name", () => {
    const profile = extractProfile(PEOPLE.maya.resumeText, PEOPLE.maya.intake);
    const buddy = profile.shipped.find((item) => item.startsWith("Study Buddy"));
    expect(buddy).toMatch(/flashcards/);
  });

  it("finds a city written with a state name or as a Bay Area line", () => {
    const city = (line: string) => extractProfile(`Ana\n${line}\nSKILLS\nPython`, { targets: ["engineering"], places: [], why: "" }).locations;
    expect(city("Austin, Texas | ana@example.com")).toEqual(["Austin"]);
    expect(city("ana@example.com | Seattle, Washington")).toEqual(["Seattle"]);
    expect(city("San Francisco Bay Area | ana@example.com")).toEqual(["San Francisco"]);
  });

  it("reads a labelled or sentence-style location line as the city alone", () => {
    const city = (line: string) => extractProfile(`Ana\n${line}\nSKILLS\nPython`, { targets: ["engineering"], places: [], why: "" }).locations;
    expect(city("Austin, TX")).toEqual(["Austin"]);
    expect(city("Location: Austin, TX")).toEqual(["Austin"]);
    expect(city("Based in San Francisco, CA")).toEqual(["San Francisco"]);
    expect(city("Located in Seattle, WA")).toEqual(["Seattle"]);
    expect(city("Engineer, CA")).toEqual([]);
  });

  it("counts a founder title line with a funding line as a founder", () => {
    for (const text of [
      "Founder & CEO, Acme AI (YC W25)\nRaised a $3M seed round",
      "Founder, Acme (YC S24)\n- Raised $1.5M pre-seed",
      "CEO and Founder, Acme\nRaised $4M seed from a16z",
    ]) {
      expect(founderScore(`Ana\n${text}`), text).toBeGreaterThanOrEqual(0.6);
    }
    expect(extractProfile("Ana\nFounder, Acme (YC S24)\n- Raised $1.5M pre-seed", intake).founderSignal.evidence).toContain("Raised $1.5M pre-seed");
    expect(founderScore("Ana\nAcme | Founder | 2021 to 2023\nRaised a $2M seed round")).toBeGreaterThanOrEqual(0.6);
    expect(founderScore("Ana\nFounder, Robotics Club")).toBeLessThan(0.3);
    expect(founderScore("Ana\nFounder side project: Quietcoach")).toBeLessThan(0.3);
  });

  it("keeps student groups away from the founder routes", () => {
    for (const text of [
      "Founder & President, Longhorn Robotics Team\nRaised $8k in sponsorships",
      "Founder, HackUT (student hackathon)\nRaised $20k from sponsors",
      "Founder, Women in CS Mentorship Program\nRaised $3k",
      "Founded the Startup Club at UT\nRaised $4k from sponsors",
      "Founded the Startup Club at UT\nBrought YC founders to campus",
      "Co-founded a student startup club",
      "Founded a Business Club",
      "Founded a student organization for first-generation engineers",
    ]) {
      expect(founderScore(`Ana\n${text}`), text).toBeLessThan(0.6);
    }
    for (const text of ["Co-founded a student startup club", "Founded a Business Club"]) expect(founderScore(`Ana\n${text}`), text).toBe(0);
  });

  it("reads a company founded with a team as a company", () => {
    expect(founderScore("Ana\nFounded a startup with a team of four engineers")).toBeGreaterThan(0);
    expect(founderScore("Ana\nCo-founded Acme with my team from school")).toBeGreaterThan(0);
  });

  it("reads new grad wording before intern wording, and interns someone works with as nothing", () => {
    const student = "Ana\nEDUCATION\nUT Austin, BS CS 2026";
    for (const why of ["A new grad role; I was an intern at Acme last summer", "Looking for a new grad role after two internships", "New grad SWE, three internships behind me"]) {
      expect(extractProfile(student, { ...intake, why }).seniority, why).toBe("new_grad");
    }
    for (const why of [
      "A summer internship", "I'd love to be an intern", "Open to internships",
      "After junior year I want an internship", "Summer after sophomore year: software internship",
      "Looking for a summer internship program", "Applying to your internship program for summer 2027",
      "I want mentorship and an internship", "Looking to be mentored in an internship",
    ]) {
      expect(extractProfile(student, { ...intake, why }).seniority, why).toBe("intern");
    }
    const staff = "Ana\nEXPERIENCE\nStaff Software Engineer, Acme, 2018 to present\n";
    for (const why of [
      "Taught interns", "Working with interns", "I want to help interns grow", "Ran the intern program", "Built the intern onboarding",
      "Mentor new grads on a small team", "A team that hires early career engineers",
    ]) {
      expect(extractProfile(staff, { ...intake, why }).seniority, why).toBe("senior");
    }
  });

  it("keeps the key words of what a project does", () => {
    const text = "Ana\nPROJECTS\nRustling\n- A package manager written in Rust. Used by about four hundred people across three teams at school every single day";
    expect(extractProfile(text, intake).shipped).toEqual(["Rustling (A package manager written in Rust)"]);
    const ravi = extractProfile(PEOPLE.ravi.resumeText, PEOPLE.ravi.intake).shipped;
    expect(ravi).toContain("Docsmith (An assistant that answers questions over a company handbook, with citations back to the source paragraph)");
    const transit = "Ana\nPROJECTS\nNext Shuttle\n- A campus app that predicts shuttle arrivals using GTFS realtime feeds and Postgres. Used daily";
    expect(extractProfile(transit, intake).shipped[0]).toMatch(/GTFS realtime feeds and Postgres\)$/);
    const long = `Ana\nPROJECTS\nLongish\n- ${"word ".repeat(60)}end.`;
    const [item] = extractProfile(long, intake).shipped;
    expect(item.length).toBeLessThanOrEqual("Longish ()".length + 140);
    expect(item).toMatch(/word\)$/);
  });
});
