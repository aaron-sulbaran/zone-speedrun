import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfWith } from "./pdfFixture";
import { postResume } from "./readClient";

// The PDF library's chunk failing to load is the network's doing, never "this PDF has no text".
vi.mock("unpdf", () => {
  throw new Error("chunk failed to load");
});

afterEach(() => vi.unstubAllGlobals());

describe("postResume with the PDF library unavailable", () => {
  it("answers network, with no request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([pdfWith("Ada Lovelace engineer")], "cv.pdf", { type: "application/pdf" });
    expect(await postResume(file, { targets: [], places: [], why: "" })).toEqual({ ok: false, error: "network" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
