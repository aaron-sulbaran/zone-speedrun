import { describe, expect, it } from "vitest";
import type { SnapshotRole } from "./snapshot";
import { cleanTitle, levelOf, namesArea, placeMatches, remoteFitsUs, shortLocation, titleFits, withArticle } from "./matchText";

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
    expect(cleanTitle("Machine Learning Engineer, New Grad - Larkmoor (Remote)", "Larkmoor")).toBe("Machine Learning Engineer, New Grad");
    expect(cleanTitle("Designer (Remote)", "Acme")).toBe("Designer");
    expect(cleanTitle("Software Engineer Intern (Summer 2027)", "Acme")).toBe("Software Engineer Intern (Summer 2027)");
  });

  it("shortens multi-city locations", () => {
    expect(shortLocation("San Francisco, CA • New York, NY", "New York")).toBe("New York, NY and 1 more");
    expect(shortLocation("Austin, TX", "Austin")).toBe("Austin, TX");
  });

  it("handles acronyms with symbols, requisition ids and United States", () => {
    expect(withArticle("FP&A Analyst")).toBe("an FP&A Analyst");
    expect(cleanTitle("Engineer I, Mechanical (R6302) - New Grad", "Tallow Aero")).toBe("Engineer I, Mechanical - New Grad");
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

  it("reads Los Angeles, never Louisiana or Venice, Italy", () => {
    for (const ok of ["Los Angeles, CA", "LA, CA", "LA", "L.A.", "Remote (LA)", "LA / Remote", "Santa Monica, CA", "Venice, CA"]) {
      expect(placeMatches("Los Angeles", ok), ok).toBe(true);
    }
    for (const bad of ["Franklin, LA", "Lafayette, LA", "La Jolla, CA", "Remote - Venice, Italy"]) {
      expect(placeMatches("Los Angeles", bad), bad).toBe(false);
    }
    expect(remoteFitsUs("Remote - Venice, Italy", ["Los Angeles", "Remote"])).toBe(false);
    expect(placeMatches("San Francisco", "Union Square, New York City")).toBe(false);
    for (const bad of ["Baton Rouge LA", "Venice Italy"]) expect(placeMatches("Los Angeles", bad), bad).toBe(false);
    expect(placeMatches("Los Angeles", "Venice Beach, CA")).toBe(true);
    expect(placeMatches("San Francisco", "New York (Union Square)")).toBe(false);
    expect(placeMatches("San Francisco", "Union Square, San Francisco")).toBe(true);
  });

  it("lets Georgia the state fit a US visitor", () => {
    expect(remoteFitsUs("Savannah, Georgia", ["Remote"])).toBe(true);
    expect(remoteFitsUs("Remote - Georgia", ["Remote"])).toBe(true);
    expect(remoteFitsUs("Tbilisi, Georgia (Remote)", ["Remote"])).toBe(false);
  });

  it("splits two cities written without a separator", () => {
    expect(shortLocation("New York, NY Menlo Park, CA", "New York")).toBe("New York, NY and 1 more");
    expect(shortLocation("San Francisco, CA Hybrid", "San Francisco")).toBe("San Francisco, CA Hybrid");
    expect(shortLocation("Washington, DC Metro Area", "Washington")).toBe("Washington, DC Metro Area");
  });

  it("drops a pipe tail that is not the company", () => {
    expect(cleanTitle("Growth PM, Next Platforms | Lodging", "Vexley")).toBe("Growth PM, Next Platforms");
    expect(cleanTitle("Vexley | Growth PM", "Vexley")).toBe("Growth PM");
    expect(cleanTitle("Software Engineer | Remote", "Acme")).toBe("Software Engineer");
  });

  const role = (title: string, seniority: string | null = null) => ({ title, seniority }) as SnapshotRole;

  it("reads a plain product manager as open to new grads, and any other manager as senior", () => {
    expect(levelOf(role("Product Manager"))).toBe(2);
    expect(levelOf(role("Associate Product Manager"))).toBe(1);
    for (const title of ["Senior Product Manager", "Group Product Manager", "Staff Product Manager", "Engineering Manager", "Director, Product"]) {
      expect(levelOf(role(title)), title).toBe(3);
    }
    expect(levelOf(role("Software Engineer, Payments Group"))).toBe(2);
  });

  it("counts Member of Technical Staff and tech lead titles as engineering", () => {
    for (const title of ["Member of Technical Staff", "Founding Member of Technical Staff", "Member of Technical Staff - Android", "Technical Lead"]) {
      expect(titleFits(role(title), "engineering"), title).toBe(true);
    }
    expect(titleFits(role("Growth PM, Next Platforms"), "product")).toBe(true);
  });
});

describe("namesArea", () => {
  it.each([
    "Product", "Product Team", "General Application", "Growth", "Founding Role", "General Interest", "Early Career",
    "Product Operations", "Strategic Finance", "Finance & Analytics", "Agentic AI Team", "Rotational Development Program",
    "Security Research", "Partnerships", "Assembly", "Inference Engineering", "Finance & Business Operations", "Sales Development",
  ])("treats %s as an area", (title) => expect(namesArea(title)).toBe(true));

  it.each([
    "Head of Product", "VP of Engineering", "Member of Technical Staff, Design", "Engineering Manager", "Software Engineering Intern",
    "Senior Product Designer (Dashboard)", "Security Researcher", "Software Engineer", "Product Manager", "AI Engineer",
  ])("treats %s as a person", (title) => expect(namesArea(title)).toBe(false));
});
