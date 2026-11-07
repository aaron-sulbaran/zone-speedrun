import { describe, expect, it } from "vitest";
import { SHIFT_MS, shiftReducer } from "./shift";

describe("the shift", () => {
  it("starts a sweep from idle", () => {
    expect(shiftReducer("idle", "go")).toBe("covering");
  });

  it("holds once the page is covered, then reveals", () => {
    expect(shiftReducer("covering", "covered")).toBe("covered");
    expect(shiftReducer("covered", "covered")).toBe("revealing");
  });

  it("returns to idle when the reveal ends", () => {
    expect(shiftReducer("revealing", "revealed")).toBe("idle");
  });

  it("ignores a second go while it is running", () => {
    expect(shiftReducer("covering", "go")).toBe("covering");
    expect(shiftReducer("covered", "go")).toBe("covered");
    expect(shiftReducer("revealing", "go")).toBe("revealing");
  });

  it("ignores events that do not belong to the phase", () => {
    expect(shiftReducer("idle", "covered")).toBe("idle");
    expect(shiftReducer("idle", "revealed")).toBe("idle");
    expect(shiftReducer("covering", "revealed")).toBe("covering");
  });

  it("abort always goes back to idle", () => {
    for (const phase of ["idle", "covering", "covered", "revealing"] as const) {
      expect(shiftReducer(phase, "abort")).toBe("idle");
    }
  });

  it("keeps the whole sweep near a second", () => {
    expect(SHIFT_MS.cover + SHIFT_MS.hold + SHIFT_MS.reveal).toBeLessThan(1300);
  });
});
