import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfWith } from "./pdfFixture";
import { EMPTY_ANSWERS, toIntake } from "./onboarding";
import { cleanText, postResume, postResumeText, readResumeFile } from "./readClient";

const INTAKE = { targets: ["engineering" as const], places: [], why: "" };
const RESUME = "Ada Lovelace\nSKILLS\nTypeScript, Postgres\nEXPERIENCE\nBuilt a billing API.";
const answer = { profile: { firstName: "Ada" }, result: { matches: [] } };

function stubFetch(impl?: () => Promise<Response>) {
  const respond = impl ?? (async () => new Response(JSON.stringify(answer), { status: 200 }));
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => respond());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const bodyOf = (fetchMock: ReturnType<typeof stubFetch>) => JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
const fileOf = (parts: BlobPart[], name: string, type = "") => new File(parts, name, { type });

afterEach(() => vi.unstubAllGlobals());

describe("cleanText", () => {
  it("strips NULs and control characters, and stops one past the cap", () => {
    expect(cleanText("a\u0000b\u0007c\td\ne")).toBe("ab c\td\ne");
    expect(cleanText("x".repeat(50_000))).toHaveLength(20_001);
  });
});

describe("postResume", () => {
  it("sends the intake with no name in the body", async () => {
    const fetchMock = stubFetch();
    const intake = toIntake({ ...EMPTY_ANSWERS, name: "Zelda Quinn", targets: ["engineering"], student: true, arrangements: ["during"], founding: true });
    await postResume(fileOf([RESUME], "cv.txt", "text/plain"), intake);
    const raw = fetchMock.mock.calls[0][1]?.body as string;
    expect(raw).not.toContain("Zelda");
    expect(bodyOf(fetchMock).intake).toMatchObject({ seniority: "intern", founding: true });
  });

  it("posts only the text of a .txt file", async () => {
    const fetchMock = stubFetch();
    const out = await postResume(fileOf([RESUME], "cv.txt", "text/plain"), INTAKE);
    expect(out.ok).toBe(true);
    expect(bodyOf(fetchMock)).toMatchObject({ text: RESUME });
  });

  it("answers too_large on the client, with no request, for text over 20,000 characters", async () => {
    const fetchMock = stubFetch();
    expect(await postResume(fileOf(["y".repeat(3_000_000)], "big.txt"), INTAKE)).toEqual({ ok: false, error: "too_large" });
    expect(await postResume(fileOf(["y".repeat(20_001)], "edge.txt"), INTAKE)).toEqual({ ok: false, error: "too_large" });
    expect(fetchMock).not.toHaveBeenCalled();
    await postResume(fileOf(["y".repeat(20_000)], "limit.txt"), INTAKE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("trims a UTF-16 .txt so the body stays small", async () => {
    const fetchMock = stubFetch();
    const utf16 = new Uint8Array(40_000);
    for (let i = 0; i < utf16.length; i += 2) utf16[i] = 65;
    await postResume(fileOf([utf16], "wide.txt"), INTAKE);
    expect(JSON.stringify(bodyOf(fetchMock)).length).toBeLessThan(96 * 1024);
    expect(bodyOf(fetchMock).text).not.toContain("\u0000");
  });

  it("extracts the text of a real PDF in the browser path and posts it", async () => {
    const fetchMock = stubFetch();
    const out = await postResume(fileOf([pdfWith("Ada Lovelace engineer")], "cv.pdf", "application/pdf"), INTAKE);
    expect(out.ok).toBe(true);
    expect(bodyOf(fetchMock).text).toContain("Ada Lovelace engineer");
  });

  it("answers on the client, with no request, for a scan, a broken PDF and a fake PDF", async () => {
    const fetchMock = stubFetch();
    const scan = await postResume(fileOf([pdfWith("")], "scan.pdf", "application/pdf"), INTAKE);
    const broken = await postResume(fileOf([new TextEncoder().encode("%PDF-1.4 garbage")], "bad.pdf"), INTAKE);
    const fake = await postResume(fileOf(["plain words"], "cv.pdf", "application/pdf"), INTAKE);
    const empty = await postResume(fileOf(["   "], "empty.txt"), INTAKE);
    expect(scan).toEqual({ ok: false, error: "unreadable" });
    expect(broken).toEqual({ ok: false, error: "unreadable" });
    expect(fake).toEqual({ ok: false, error: "bad_input" });
    expect(empty).toEqual({ ok: false, error: "unreadable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers bad_input for another type and too_large for a big file, with no request", async () => {
    const fetchMock = stubFetch();
    expect(await postResume(fileOf(["x"], "me.png", "image/png"), INTAKE)).toEqual({ ok: false, error: "bad_input" });
    expect(await postResume(fileOf([new Uint8Array(4 * 1024 * 1024 + 1)], "big.txt"), INTAKE)).toEqual({ ok: false, error: "too_large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives up with network when the wait outlasts the deadline", async () => {
    const fetchMock = stubFetch(() => new Promise(() => {}));
    const out = await postResume(fileOf([RESUME], "cv.txt"), INTAKE, 40);
    expect(out).toEqual({ ok: false, error: "network" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps server error codes", async () => {
    stubFetch(async () => new Response(JSON.stringify({ error: "slow_down" }), { status: 429 }));
    expect(await postResume(fileOf([RESUME], "cv.txt"), INTAKE)).toEqual({ ok: false, error: "slow_down" });
    stubFetch(async () => new Response("<html>", { status: 502 }));
    expect(await postResume(fileOf([RESUME], "cv.txt"), INTAKE)).toEqual({ ok: false, error: "network" });
  });
});

describe("readResumeFile and postResumeText", () => {
  it("answers a local rejection with no request: wrong type, too large, empty text", async () => {
    const fetchMock = stubFetch();
    expect(await readResumeFile(fileOf(["x"], "cv.docx"))).toEqual({ ok: false, error: "bad_input" });
    expect(await readResumeFile(fileOf(["y".repeat(5 * 1024 * 1024)], "big.txt"))).toEqual({ ok: false, error: "too_large" });
    expect(await readResumeFile(fileOf(["   \n "], "empty.txt", "text/plain"))).toEqual({ ok: false, error: "unreadable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hands back the text of a good file, then posts it", async () => {
    const fetchMock = stubFetch();
    const read = await readResumeFile(fileOf([RESUME], "cv.txt", "text/plain"));
    expect(read).toEqual({ text: RESUME });
    expect(fetchMock).not.toHaveBeenCalled();
    const out = await postResumeText(RESUME, INTAKE);
    expect(out.ok).toBe(true);
    expect(bodyOf(fetchMock)).toMatchObject({ text: RESUME });
  });
});
