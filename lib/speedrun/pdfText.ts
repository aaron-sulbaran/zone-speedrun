// Text out of a PDF, in memory. Nothing is written anywhere. A PDF with no text
// layer (a scan or an image) comes back as an empty string.

const MAX_PAGES = 12;

export class PdfTooLongError extends Error {}

export async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  if (doc.numPages > MAX_PAGES) throw new PdfTooLongError("too_many_pages");
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}
