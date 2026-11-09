import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTION, motion } from "./motion";
import { getMotionOverrides, resetMotionOverrides, setMotionOverrides, subscribeMotion } from "./tuning";

afterEach(() => resetMotionOverrides());

describe("motion tuning", () => {
  it("is the constants by default", () => {
    expect(motion()).toEqual(MOTION);
    expect(getMotionOverrides()).toEqual({});
  });

  it("overrides one value and leaves the rest", () => {
    setMotionOverrides({ coverMs: 300 });
    expect(motion().coverMs).toBe(300);
    expect(motion().holdMs).toBe(MOTION.holdMs);
  });

  it("merges later patches into earlier ones", () => {
    setMotionOverrides({ coverMs: 300 });
    setMotionOverrides({ holdMs: 50 });
    expect(motion()).toEqual({ ...MOTION, coverMs: 300, holdMs: 50 });
  });

  it("restores on reset", () => {
    setMotionOverrides({ coverMs: 300 });
    resetMotionOverrides();
    expect(motion()).toEqual(MOTION);
  });

  it("calls subscribers on each set and reset, until unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMotion(listener);
    setMotionOverrides({ coverMs: 1 });
    resetMotionOverrides();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setMotionOverrides({ coverMs: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
