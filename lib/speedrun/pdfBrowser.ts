// Text out of a PDF, in the visitor's browser. The server never parses a stranger's
// file: only the text this returns is ever posted. Nothing is stored anywhere.

const MAX_PAGES = 10;
const MAX_CHARS = 20_000;
const TIMEOUT_MS = 8_000;
const MAX_IMAGE_PIXELS = 16_777_216;

/** Resolves to the text (possibly empty for a scan), and throws on a broken or slow PDF. */
export async function pdfTextInBrowser(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes, { maxImageSize: MAX_IMAGE_PIXELS });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = (async () => {
      let text = "";
      for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES) && text.length <= MAX_CHARS; n += 1) {
        const page = await doc.getPage(n);
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
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    });
    return await Promise.race([read, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    await doc.loadingTask.destroy();
  }
}
