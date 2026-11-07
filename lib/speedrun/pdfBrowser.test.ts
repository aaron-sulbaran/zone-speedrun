import { describe, expect, it } from "vitest";
import { pdfTextInBrowser } from "./pdfBrowser";
import { pdfWith } from "./pdfFixture";

describe("pdfTextInBrowser", () => {
  it("returns the text layer", async () => {
    expect(await pdfTextInBrowser(pdfWith("Ada Lovelace engineer"))).toContain("Ada Lovelace engineer");
  });

  it("returns nothing readable for a page with no text", async () => {
    expect((await pdfTextInBrowser(pdfWith(""))).trim()).toBe("");
  });

  it("throws for bytes that are not a PDF", async () => {
    await expect(pdfTextInBrowser(new TextEncoder().encode("not a pdf"))).rejects.toThrow();
  });
});
