import { describe, expect, it } from "vitest";
import { pdfTextInBrowser } from "./pdfBrowser";

// A one-page PDF built by hand; the reader rebuilds the missing cross-reference table.
function pdfWith(content: string): Uint8Array {
  const stream = content ? `BT /F1 12 Tf 72 720 Td (${content}) Tj ET` : "";
  const body = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  return new TextEncoder().encode(body);
}

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
