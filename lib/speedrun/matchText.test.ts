import { describe, expect, it } from "vitest";
import { cleanTitle, placeMatches, remoteFitsUs, shortLocation, withArticle } from "./matchText";

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

  it("handles acronyms with symbols, requisition ids and United States", () => {
    expect(withArticle("FP&A Analyst")).toBe("an FP&A Analyst");
    expect(cleanTitle("Engineer I, Mechanical (R6302) - New Grad", "Shield AI")).toBe("Engineer I, Mechanical - New Grad");
    expect(cleanTitle("Analyst (Req 12345)", "Acme")).toBe("Analyst");
    expect(shortLocation("San Francisco, CA \u2022 New York, NY \u2022 United States", "San Francisco")).toBe("San Francisco, CA and 1 more");
  });

  it("lets a remote role fit a US visitor only when it is here or generic", () => {
    const fits = (loc: string | null, places: string[] = ["Remote"]) => remoteFitsUs(loc, places);
    for (const ok of [null, "", "Remote", "Remote - Multiple Locations", "Anywhere", "United States", "North America", "Texas", "Dublin, CA", "New London, CT", "Indiana", "Seattle, WA", "San Francisco / Bay Area", "Remote or Hybrid", "Remote \u2013 PST Working Hours"]) {
      expect(fits(ok), String(ok)).toBe(true);
    }
    for (const bad of ["Canada", "Toronto - Canada", "Mexico City, Mexico", "Madrid, Spain", "Zurich, Switzerland", "Istanbul, Turkey", "Ho Chi Minh City, Vietnam", "Shanghai, China", "Seoul, South Korea", "India", "London, UK", "Dublin, Ireland", "Australia (Remote)", "Abu Dhabi, United Arab Emirates; London, England, United Kingdom", "Remote - Venice, Italy", "Tbilisi, Georgia"]) {
      expect(fits(bad), bad).toBe(false);
    }
    expect(fits("Toronto - Canada", ["Toronto"])).toBe(true);
  });

  it("matches places on whole words", () => {
    expect(placeMatches("London", "New London, CT")).toBe(false);
    expect(placeMatches("Austin", "Austin, TX")).toBe(true);
    expect(placeMatches("Dublin", "Dublin, CA")).toBe(false);
    expect(placeMatches("Rome", "Jerome, AZ")).toBe(false);
  });
});
