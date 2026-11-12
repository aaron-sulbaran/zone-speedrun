import { describe, expect, it } from "vitest";
import { speedrunCopy } from "@/lib/content";
import type { Action } from "./actions";
import { dayCell, deadlineText, plainNextStep, stageLabel } from "./boardLabels";
import type { AppRow } from "./types";

const copy = speedrunCopy.board;
const row = (over: Partial<AppRow>): AppRow => ({ company: "A", role: null, lane: "jobs", furthest: "screen", exit: "open", appliedAt: null, lastEventAt: "2026-11-01", next: "Prepare for the screen", ...over });
const action = (over: Partial<Action>) => ({ due: null, quietDays: null, ...over }) as Action;

describe("deadlineText", () => {
  it("words a due date, and otherwise how long it has been quiet", () => {
    expect(deadlineText(action({ due: "2026-11-09" }))).toBe(copy.needs.due("Nov 9"));
    expect(deadlineText(action({ quietDays: 9 }))).toBe(copy.needs.quiet(9));
    expect(deadlineText(action({ quietDays: 0 }))).toBe(copy.needs.quiet(0));
  });
});

describe("dayCell", () => {
  it("shows a date, or the dash with plain words for a row with no such date", () => {
    expect(dayCell("2026-10-04T09:00:00.000Z")).toEqual({ text: "Oct 4", hint: null });
    expect(dayCell(null)).toEqual({ text: copy.table.noDate, hint: copy.table.noApplied });
  });
});

describe("stageLabel and plainNextStep", () => {
  it("names the stage reached, or how the row ended", () => {
    expect(stageLabel(row({}))).toBe(speedrunCopy.flow.stages.screen);
    expect(stageLabel(row({ exit: "rejected" }))).toBe(speedrunCopy.flow.exits.rejected);
    expect(stageLabel(row({ exit: "noreply" }))).toBe(speedrunCopy.flow.exits.noreply);
  });
  it("gives a closed row no next step to take", () => {
    expect(plainNextStep(row({}))).toBe("Prepare for the screen");
    expect(plainNextStep(row({ exit: "rejected" }))).toBe(copy.table.closed);
    expect(plainNextStep(row({ exit: "noreply" }))).toBe(copy.table.quiet);
  });
});
