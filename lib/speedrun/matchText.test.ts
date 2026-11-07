import { describe, expect, it } from "vitest";
import { cleanTitle, shortLocation, withArticle } from "./matchText";

describe("matchText", () => {
  it("picks the right article", () => {
    expect(withArticle("UX Designer")).toBe("a UX Designer");
    expect(withArticle("Unity Developer")).toBe("a Unity Developer");
    expect(withArticle("SRE")).toBe("an SRE");
    expect(withArticle("AI Engineer")).toBe("an AI Engineer");
    expect(withArticle("Software Engineer")).toBe("a Software Engineer");
    expect(withArticle("Early Career Designer")).toBe("an Early Career Designer");
  });

  it("strips company suffixes and remote tags", () => {
    expect(cleanTitle("Machine Learning Engineer, New Grad - Quora (Remote)", "Quora")).toBe("Machine Learning Engineer, New Grad");
    expect(cleanTitle("Designer (Remote)", "Acme")).toBe("Designer");
    expect(cleanTitle("Software Engineer Intern (Summer 2027)", "Acme")).toBe("Software Engineer Intern (Summer 2027)");
  });

  it("shortens multi-city locations", () => {
    expect(shortLocation("San Francisco, CA • New York, NY", "New York")).toBe("New York, NY and 1 more");
    expect(shortLocation("Austin, TX", "Austin")).toBe("Austin, TX");
  });
});
