import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, toIntake } from "./onboarding";
import { briefRequestBody, matchRequestBody } from "./requests";

describe("matchRequestBody", () => {
  it("carries the visitor's arrangements to the match route", () => {
    const intake = toIntake({ ...EMPTY_ANSWERS, student: true, arrangements: ["between"] });
    expect(JSON.parse(matchRequestBody(intake, "maya")).intake.asks).toEqual(["between"]);
  });

  it("never carries the visitor's name", () => {
    const intake = toIntake({ ...EMPTY_ANSWERS, name: "Zelda Quinn", targets: ["ai"] });
    const body = matchRequestBody(intake, "sam");
    expect(body).not.toContain("Zelda");
    expect(JSON.parse(body)).toEqual({ intake: { targets: ["ai"], places: [], why: "" }, personKey: "sam" });
  });

  it("caps nine places at eight", () => {
    const places = Array.from({ length: 9 }, (_, i) => `City ${i}`);
    const parsed = JSON.parse(matchRequestBody(toIntake({ ...EMPTY_ANSWERS, places }), "dev"));
    expect(parsed.intake.places).toHaveLength(8);
  });

  it("carries the student and founding answers", () => {
    const parsed = JSON.parse(matchRequestBody({ targets: [], places: [], why: "", seniority: "intern", founding: true }, "maya"));
    expect(parsed.intake).toMatchObject({ seniority: "intern", founding: true });
  });
});

describe("briefRequestBody", () => {
  const fields = { email: "visitor@example.com", personKey: "sam" as const, connected: true, roleIds: ["r1", "r2"] };

  it("carries exactly the address, the sample person, the inbox flag and the role ids", () => {
    expect(JSON.parse(briefRequestBody(fields))).toEqual(fields);
  });

  it("never carries a typed name, even one smuggled into the fields", () => {
    const body = briefRequestBody({ ...fields, name: "Zelda Quinn", answers: { name: "Zelda Quinn" } } as typeof fields);
    expect(body).not.toContain("Zelda");
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["connected", "email", "personKey", "roleIds"]);
  });
});
