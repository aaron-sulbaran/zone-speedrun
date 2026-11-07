import { describe, expect, it, vi } from "vitest";
import { PdfTooLongError } from "./pdfText";
import { handleRead, MAX_FILE_BYTES, MAX_TEXT_CHARS, type ReadDeps, type ReadInput, type UploadedFile } from "./readHandler";

const INTAKE = JSON.stringify({ targets: ["engineering"], places: [], why: "" });
const RESUME =
  "Ada Lovelace\nSKILLS\nTypeScript, Postgres, React\nEXPERIENCE\nBuilt a billing API in TypeScript and shipped it to customers.";

function deps(over: Partial<ReadDeps> = {}): ReadDeps {
  return {
    live: true,
    isBot: async () => false,
    allow: () => ({ ok: true, retryAfterMs: 0 }),
    model: null,
    pdfText: async () => RESUME,
    ...over,
  };
}

function input(form: Awaited<ReturnType<ReadInput["form"]>>, contentLength: number | null = null): ReadInput {
  return { contentLength, form: async () => form };
}

function file(name: string, type: string, content: string | Uint8Array, size?: number): UploadedFile {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return { name, type, size: size ?? bytes.byteLength, bytes: async () => bytes };
}

const pdfBytes = new TextEncoder().encode("%PDF-1.7 fake");

describe("handleRead", () => {
  it("503 live_off when the switch is off, before any other work", async () => {
    const isBot = vi.fn(async () => false);
    const out = await handleRead(input({ file: null, text: RESUME, intake: INTAKE }), deps({ live: false, isBot }));
    expect(out).toEqual({ status: 503, body: { error: "live_off" } });
    expect(isBot).not.toHaveBeenCalled();
  });

  it("403 bot when the check says bot", async () => {
    const out = await handleRead(input({ file: null, text: RESUME, intake: INTAKE }), deps({ isBot: async () => true }));
    expect(out).toEqual({ status: 403, body: { error: "bot" } });
  });

  it("429 with retryAfterMs when the limiter refuses", async () => {
    const out = await handleRead(
      input({ file: null, text: RESUME, intake: INTAKE }),
      deps({ allow: () => ({ ok: false, retryAfterMs: 4000 }) }),
    );
    expect(out).toEqual({ status: 429, body: { error: "slow_down", retryAfterMs: 4000 } });
  });

  it("400 bad_input for a missing or malformed intake", async () => {
    const none = await handleRead(input({ file: null, text: RESUME, intake: null }), deps());
    const broken = await handleRead(input({ file: null, text: RESUME, intake: "{nope" }), deps());
    const wrong = await handleRead(
      input({ file: null, text: RESUME, intake: JSON.stringify({ targets: ["plumbing"], places: [], why: "" }) }),
      deps(),
    );
    for (const out of [none, broken, wrong]) expect(out).toEqual({ status: 400, body: { error: "bad_input" } });
  });

  it("400 bad_input with neither file nor text, or an unsupported file type", async () => {
    const empty = await handleRead(input({ file: null, text: null, intake: INTAKE }), deps());
    const image = await handleRead(input({ file: file("me.png", "image/png", "xxxx"), text: null, intake: INTAKE }), deps());
    expect(empty.status).toBe(400);
    expect(image.status).toBe(400);
  });

  it("400 bad_input when a .pdf is not a PDF", async () => {
    const out = await handleRead(input({ file: file("cv.pdf", "application/pdf", "plain words"), text: null, intake: INTAKE }), deps());
    expect(out.status).toBe(400);
  });

  it("413 too_large for a big file, a long text, a long extraction and a huge request", async () => {
    const big = await handleRead(
      input({ file: file("cv.txt", "text/plain", "x", MAX_FILE_BYTES + 1), text: null, intake: INTAKE }),
      deps(),
    );
    const longText = await handleRead(input({ file: null, text: "a".repeat(MAX_TEXT_CHARS + 1), intake: INTAKE }), deps());
    const longPdf = await handleRead(
      input({ file: file("cv.pdf", "application/pdf", pdfBytes), text: null, intake: INTAKE }),
      deps({ pdfText: async () => "a".repeat(MAX_TEXT_CHARS + 1) }),
    );
    const manyPages = await handleRead(
      input({ file: file("cv.pdf", "application/pdf", pdfBytes), text: null, intake: INTAKE }),
      deps({ pdfText: async () => { throw new PdfTooLongError("pages"); } }),
    );
    const huge = await handleRead(input({ file: null, text: RESUME, intake: INTAKE }, MAX_FILE_BYTES * 2), deps());
    for (const out of [big, longText, longPdf, manyPages, huge]) expect(out).toEqual({ status: 413, body: { error: "too_large" } });
  });

  it("422 unreadable for a PDF with no text layer, a broken PDF and an empty text file", async () => {
    const scan = await handleRead(
      input({ file: file("cv.pdf", "application/pdf", pdfBytes), text: null, intake: INTAKE }),
      deps({ pdfText: async () => "  \n " }),
    );
    const broken = await handleRead(
      input({ file: file("cv.pdf", "application/pdf", pdfBytes), text: null, intake: INTAKE }),
      deps({ pdfText: async () => { throw new Error("corrupt"); } }),
    );
    const blank = await handleRead(input({ file: file("cv.txt", "text/plain", "   "), text: null, intake: INTAKE }), deps());
    for (const out of [scan, broken, blank]) expect(out).toEqual({ status: 422, body: { error: "unreadable" } });
  });

  it("400 bad_input when the form cannot be parsed", async () => {
    const out = await handleRead({ contentLength: null, form: async () => { throw new Error("bad multipart"); } }, deps());
    expect(out.status).toBe(400);
  });

  it("200 with the rules reader when there is no model", async () => {
    const out = await handleRead(input({ file: null, text: RESUME, intake: INTAKE }), deps());
    expect(out.status).toBe(200);
    if (out.status !== 200) return;
    expect(out.body.mode).toBe("rules");
    expect(out.body.profile.source).toBe("rules");
    expect(out.body.result.matches.length).toBeLessThanOrEqual(6);
  });

  it("200 for a text file and for a PDF", async () => {
    const txt = await handleRead(input({ file: file("cv.txt", "text/plain", RESUME), text: null, intake: INTAKE }), deps());
    const pdf = await handleRead(input({ file: file("cv.pdf", "application/pdf", pdfBytes), text: null, intake: INTAKE }), deps());
    expect(txt.status).toBe(200);
    expect(pdf.status).toBe(200);
  });
});
