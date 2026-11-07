// Text out of a PDF, in the visitor's browser. The server never parses a stranger's
// file: only the text this returns is ever posted. Nothing is stored anywhere.

const MAX_PAGES = 10;
const MAX_CHARS = 20_000;
const TIMEOUT_MS = 8_000;
const MAX_IMAGE_PIXELS = 16_777_216;

/** The PDF library's chunk could not be fetched: a network problem, not a problem with the file. */
export class PdfLibraryError extends Error {}

/** Resolves to the text (possibly empty for a scan), and throws on a broken or slow PDF. */
export async function pdfTextInBrowser(bytes: Uint8Array): Promise<string> {
  // The chunk load stays outside the 8 s race, so a slow network is never read as a PDF with no text.
  let getDocumentProxy: typeof import("unpdf").getDocumentProxy;
  try {
    ({ getDocumentProxy } = await import("unpdf"));
  } catch {
    throw new PdfLibraryError("library");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let doc: Awaited<ReturnType<typeof import("unpdf").getDocumentProxy>> | undefined;
  let abandoned = false;
  const read = (async () => {
    const loaded = await getDocumentProxy(bytes, { maxImageSize: MAX_IMAGE_PIXELS });
    if (abandoned) {
      await loaded.loadingTask.destroy();
      throw new Error("timeout");
    }
    doc = loaded;
    let text = "";
    for (let n = 1; n <= Math.min(loaded.numPages, MAX_PAGES) && text.length <= MAX_CHARS; n += 1) {
      const page = await loaded.getPage(n);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) text += item.hasEOL ? `${item.str}\n` : item.str;
      }
      text += "\n";
      page.cleanup();
    }
    // One past the cap is enough for the server to say "too large".
    return text.slice(0, MAX_CHARS + 1);
  })();
  read.catch(() => {});
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    abandoned = true;
    if (timer) clearTimeout(timer);
    await doc?.loadingTask.destroy();
  }
}
