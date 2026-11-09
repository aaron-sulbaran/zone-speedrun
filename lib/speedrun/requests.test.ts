import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, toIntake } from "./onboarding";
import { matchRequestBody } from "./requests";

describe("matchRequestBody", () => {
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
