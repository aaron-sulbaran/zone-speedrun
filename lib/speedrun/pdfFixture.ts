// A one-page PDF built by hand from fictional text, for tests. The reader rebuilds
// the missing cross-reference table. An empty string gives a page with no text layer.
export function pdfWith(content: string): Uint8Array<ArrayBuffer> {
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
