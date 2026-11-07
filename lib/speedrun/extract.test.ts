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
});
