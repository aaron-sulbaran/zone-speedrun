import type { Fn, Intake } from "./types";

export type StepKey = "name" | "targets" | "student" | "arrangements" | "places" | "founding" | "why" | "resume";

export type Arrangement = "between" | "during" | "whileInSchool" | "afterGrad";

/** Options A to D, in order. */
export const ARRANGEMENTS: readonly Arrangement[] = ["between", "during", "whileInSchool", "afterGrad"];

export type Answers = {
  name: string;
  targets: Fn[];
  student: boolean | null;
  arrangements: Arrangement[];
  places: string[];
  founding: boolean | null;
  why: string;
};

export const NAME_MAX = 40;

export const EMPTY_ANSWERS: Answers = {
  name: "",
  targets: [],
  student: null,
  arrangements: [],
  places: [],
  founding: null,
  why: "",
};

export function stepsFor(answers: Answers): StepKey[] {
  const steps: StepKey[] = ["name", "targets", "student", "places", "founding", "why", "resume"];
  if (answers.student === true) steps.splice(3, 0, "arrangements");
  return steps;
}

export function cleanName(raw: string): string {
  return Array.from(raw.trim().replace(/\s+/g, " ")).slice(0, NAME_MAX).join("").trimEnd();
}

export function isStepValid(step: StepKey, answers: Answers, ctx: { resumeChosen: boolean }): boolean {
  switch (step) {
    case "name":
      return cleanName(answers.name).length >= 1;
    case "targets":
      return answers.targets.length > 0;
    case "student":
      return answers.student !== null;
    case "arrangements":
      return answers.arrangements.length > 0;
    case "founding":
      return answers.founding !== null;
    case "places":
    case "why":
      return true;
    case "resume":
      return ctx.resumeChosen;
  }
}

export function seniorityFor(answers: Answers): Intake["seniority"] {
  if (answers.student !== true || answers.arrangements.length === 0) return undefined;
  const afterSchool = answers.arrangements.some((a) => a === "whileInSchool" || a === "afterGrad");
  return afterSchool ? "new_grad" : "intern";
}

/** What the match and read routes may see. The visitor's name never goes in. */
export function toIntake(answers: Answers): Intake {
  const intake: Intake = { targets: answers.targets, places: answers.places, why: answers.why };
  const seniority = seniorityFor(answers);
  if (seniority) intake.seniority = seniority;
  if (answers.student === true && answers.arrangements.length > 0) intake.asks = answers.arrangements;
  if (answers.founding === true) intake.founding = true;
  return intake;
}

export function displayName(answers: Answers, personFirstName: string | null, fallback: string): string {
  return cleanName(answers.name) || personFirstName || fallback;
}
