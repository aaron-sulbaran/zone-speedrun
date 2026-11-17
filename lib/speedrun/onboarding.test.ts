import { describe, expect, it } from "vitest";
import { cleanName, displayName, EMPTY_ANSWERS, isStepValid, seniorityFor, stepsFor, toIntake } from "./onboarding";

const ctx = { resumeChosen: false };

describe("stepsFor", () => {
  it("lists seven steps for a non-student", () => {
    expect(stepsFor(EMPTY_ANSWERS)).toEqual(["name", "targets", "student", "places", "founding", "why", "resume"]);
  });
  it("inserts arrangements after student for a student", () => {
    const steps = stepsFor({ ...EMPTY_ANSWERS, student: true });
    expect(steps).toHaveLength(8);
    expect(steps[3]).toBe("arrangements");
    expect(steps[2]).toBe("student");
  });
});

describe("cleanName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanName("  Alex   Rivera ")).toBe("Alex Rivera");
  });
  it("returns empty for whitespace only", () => {
    expect(cleanName("   ")).toBe("");
  });
  it("cuts to 40 characters", () => {
    expect(cleanName("a".repeat(41))).toHaveLength(40);
  });
  it("never ends in a space when the cut lands on one", () => {
    const cut = cleanName("a".repeat(39) + " bcd");
    expect(cut).toBe("a".repeat(39));
  });
  it("does not split an emoji at the boundary", () => {
    const cut = cleanName("a".repeat(39) + "\u{1F600}\u{1F600}");
    expect(Array.from(cut)).toHaveLength(40);
    expect(cut.endsWith("\u{1F600}")).toBe(true);
  });
  it("leaves markup alone", () => {
    expect(cleanName("<b>Al</b>")).toBe("<b>Al</b>");
  });
});

describe("isStepValid", () => {
  it("needs a real name", () => {
    expect(isStepValid("name", { ...EMPTY_ANSWERS, name: "   " }, ctx)).toBe(false);
    expect(isStepValid("name", { ...EMPTY_ANSWERS, name: "Al" }, ctx)).toBe(true);
  });
  it("needs at least one target and one arrangement", () => {
    expect(isStepValid("targets", EMPTY_ANSWERS, ctx)).toBe(false);
    expect(isStepValid("targets", { ...EMPTY_ANSWERS, targets: ["product"] }, ctx)).toBe(true);
    expect(isStepValid("arrangements", EMPTY_ANSWERS, ctx)).toBe(false);
    expect(isStepValid("arrangements", { ...EMPTY_ANSWERS, arrangements: ["between"] }, ctx)).toBe(true);
  });
  it("needs a boolean for student and founding", () => {
    expect(isStepValid("student", EMPTY_ANSWERS, ctx)).toBe(false);
    expect(isStepValid("student", { ...EMPTY_ANSWERS, student: false }, ctx)).toBe(true);
    expect(isStepValid("founding", EMPTY_ANSWERS, ctx)).toBe(false);
    expect(isStepValid("founding", { ...EMPTY_ANSWERS, founding: false }, ctx)).toBe(true);
  });
  it("follows resumeChosen for the resume step", () => {
    expect(isStepValid("resume", EMPTY_ANSWERS, { resumeChosen: false })).toBe(false);
    expect(isStepValid("resume", EMPTY_ANSWERS, { resumeChosen: true })).toBe(true);
  });
  it("always accepts places and why", () => {
    expect(isStepValid("places", EMPTY_ANSWERS, ctx)).toBe(true);
    expect(isStepValid("why", EMPTY_ANSWERS, ctx)).toBe(true);
  });
});

describe("seniorityFor", () => {
  it("is undefined for a non-student", () => {
    expect(seniorityFor({ ...EMPTY_ANSWERS, student: false, arrangements: ["between"] })).toBeUndefined();
    expect(seniorityFor({ ...EMPTY_ANSWERS, student: null, arrangements: ["between"] })).toBeUndefined();
  });
  it("maps arrangements for a student", () => {
    const student = { ...EMPTY_ANSWERS, student: true };
    expect(seniorityFor({ ...student, arrangements: ["between"] })).toBe("intern");
    expect(seniorityFor({ ...student, arrangements: ["during"] })).toBe("intern");
    expect(seniorityFor({ ...student, arrangements: ["during", "afterGrad"] })).toBe("new_grad");
    expect(seniorityFor({ ...student, arrangements: ["whileInSchool"] })).toBe("new_grad");
    expect(seniorityFor({ ...student, arrangements: [] })).toBeUndefined();
  });
});

describe("toIntake", () => {
  it("never carries the name", () => {
    const intake = toIntake({ ...EMPTY_ANSWERS, name: "Alex", targets: ["product"], founding: true });
    expect("name" in intake).toBe(false);
    expect(JSON.stringify(intake)).not.toContain("Alex");
    expect(intake.founding).toBe(true);
  });
  it("omits founding unless true", () => {
    expect("founding" in toIntake({ ...EMPTY_ANSWERS, founding: false })).toBe(false);
    expect("founding" in toIntake({ ...EMPTY_ANSWERS, founding: null })).toBe(false);
  });
  it("carries the arrangements of a student, and no one else's", () => {
    const student = { ...EMPTY_ANSWERS, student: true };
    expect(toIntake({ ...student, arrangements: ["whileInSchool", "afterGrad"] }).asks).toEqual(["whileInSchool", "afterGrad"]);
    expect("asks" in toIntake({ ...student, arrangements: [] })).toBe(false);
    expect("asks" in toIntake({ ...EMPTY_ANSWERS, student: false, arrangements: ["between"] })).toBe(false);
    expect("asks" in toIntake({ ...EMPTY_ANSWERS, student: null, arrangements: ["between"] })).toBe(false);
  });
  it("carries seniority only when defined", () => {
    expect("seniority" in toIntake(EMPTY_ANSWERS)).toBe(false);
    expect(toIntake({ ...EMPTY_ANSWERS, student: true, arrangements: ["between"] }).seniority).toBe("intern");
  });
});

describe("displayName", () => {
  it("prefers the typed name, then the person, then the fallback", () => {
    expect(displayName({ ...EMPTY_ANSWERS, name: " Alex " }, "Sam", "you")).toBe("Alex");
    expect(displayName(EMPTY_ANSWERS, "Sam", "you")).toBe("Sam");
    expect(displayName(EMPTY_ANSWERS, null, "you")).toBe("you");
  });
});
