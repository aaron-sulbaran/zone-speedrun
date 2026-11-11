import { describe, expect, it } from "vitest";
import { MOTION } from "./motion";
import { shiftReducer } from "./shift";

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

  it("never restarts from covering, covered or revealing, however many times go arrives", () => {
    for (const phase of ["covering", "covered", "revealing"] as const) {
      expect(shiftReducer(shiftReducer(phase, "go"), "go")).toBe(phase);
    }
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

  it("keeps the whole sweep under a second and a half, with the line gone before the reveal ends", () => {
    expect(MOTION.coverMs + MOTION.holdMs + MOTION.revealMs).toBeLessThan(1500);
    expect(MOTION.lineDelayMs + 2 * MOTION.lineFadeMs + MOTION.lineHoldMs).toBeLessThanOrEqual(MOTION.coverMs + MOTION.holdMs + MOTION.revealMs);
  });
});
