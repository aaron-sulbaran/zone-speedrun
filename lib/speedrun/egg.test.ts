import { describe, expect, it } from "vitest";
import { isTypingTarget, pushClick, pushKey } from "./egg";

function typeAll(text: string) {
  let buffer = "";
  let matches = 0;
  for (const key of text) {
    const step = pushKey(buffer, key);
    buffer = step.buffer;
    if (step.matched) matches += 1;
  }
  return matches;
}

describe("pushKey", () => {
  it("matches sux across separate keystrokes", () => {
    expect(typeAll("sux")).toBe(1);
  });
  it("is case-insensitive", () => {
    expect(typeAll("SuX")).toBe(1);
  });
  it("slides past other keys before the word", () => {
    expect(typeAll("hello sux")).toBe(1);
    expect(typeAll("ssux")).toBe(1);
  });
  it("does not match a broken word", () => {
    expect(typeAll("su x")).toBe(0);
    expect(typeAll("sxu")).toBe(0);
  });
  it("ignores non-character keys", () => {
    expect(pushKey("su", "Shift")).toEqual({ buffer: "su", matched: false });
    expect(typeAll("su")).toBe(0);
  });
  it("clears after a match so the word can be typed again", () => {
    expect(typeAll("suxsux")).toBe(2);
  });
});

describe("pushClick", () => {
  it("matches the fifth click inside the window", () => {
    let times: number[] = [];
    let matched = false;
    for (const now of [0, 300, 600, 900, 1200]) ({ times, matched } = pushClick(times, now));
    expect(matched).toBe(true);
    expect(times).toEqual([]);
  });
  it("does not match four clicks", () => {
    let times: number[] = [];
    let matched = false;
    for (const now of [0, 100, 200, 300]) ({ times, matched } = pushClick(times, now));
    expect(matched).toBe(false);
  });
  it("drops clicks outside the window", () => {
    let times: number[] = [];
    let matched = false;
    for (const now of [0, 500, 1000, 1500, 2600]) ({ times, matched } = pushClick(times, now));
    expect(matched).toBe(false);
    expect(times).toEqual([1000, 1500, 2600]);
  });
  it("counts again after a reveal", () => {
    let times: number[] = [];
    let matches = 0;
    for (let i = 0; i < 10; i++) {
      const step = pushClick(times, i * 100);
      times = step.times;
      if (step.matched) matches += 1;
    }
    expect(matches).toBe(2);
  });
});

describe("isTypingTarget", () => {
  it("covers fields and editable content", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });
  it("leaves other targets alone", () => {
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
