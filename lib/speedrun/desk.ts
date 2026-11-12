import { DESK_SAMPLES, rivalsFor, type DeskStage, type SampleCard } from "./deskSamples";
import type { IntroRequest } from "./introRequest";

export type Beat = "arrive" | "review" | "sent" | "sentInstead" | "interested" | "notNow" | "introSent" | "twoWeeks";

export type DeskState = {
  beat: Beat;
  panel: null | "compare" | "intro" | "sample";
  founderOpen: boolean;
  rivalSent: string | null;
  stage: DeskStage;
  sampleSeen: boolean;
  arrivedKey: string | null;
};

export const INITIAL_DESK: DeskState = {
  beat: "arrive",
  panel: null,
  founderOpen: false,
  rivalSent: null,
  stage: "requested",
  sampleSeen: false,
  arrivedKey: null,
};

export type DeskAction =
  | { type: "review" }
  | { type: "closePanel" }
  | { type: "settle" }
  | { type: "openFounder" }
  | { type: "openIntro" }
  | { type: "send" }
  | { type: "sendInstead"; rivalId: string }
  | { type: "founder"; yes: boolean }
  | { type: "sendIntro" }
  | { type: "twoWeeks" }
  | { type: "selectStage"; stage: DeskStage }
  | { type: "arrived"; key: string };

export type IntroEffect =
  | { type: "advance"; to: "withFounder" | "connected" }
  | { type: "sendIntro" }
  | { type: "pass"; by: "team" | "founder" };

export function stageOf(request: IntroRequest | null): DeskStage | null {
  if (!request || request.status === "passed") return null;
  return request.status;
}

/** One legal move at a time: anything the table does not allow returns the desk unchanged, with no effect. */
export function deskStep(
  desk: DeskState,
  request: IntroRequest | null,
  action: DeskAction,
): { desk: DeskState; effect: IntroEffect | null } {
  const refuse = { desk, effect: null };
  const status = request?.status;
  switch (action.type) {
    case "review":
      return status === "requested" ? { desk: { ...desk, panel: "compare", beat: "review" }, effect: null } : refuse;
    case "send":
      return status === "requested" && desk.panel === "compare"
        ? { desk: { ...desk, panel: null, founderOpen: true, beat: "sent", stage: "withFounder" }, effect: { type: "advance", to: "withFounder" } }
        : refuse;
    case "sendInstead":
      return request && status === "requested" && desk.panel === "compare" && rivalsFor(request.match).some((r) => r.id === action.rivalId)
        ? { desk: { ...desk, panel: null, rivalSent: action.rivalId, beat: "sentInstead", stage: "requested" }, effect: { type: "pass", by: "team" } }
        : refuse;
    case "openFounder":
      return status === "withFounder" ? { desk: { ...desk, founderOpen: true }, effect: null } : refuse;
    case "openIntro":
      return status === "connected" ? { desk: { ...desk, panel: "intro" }, effect: null } : refuse;
    case "founder":
      if (status !== "withFounder" || !desk.founderOpen) return refuse;
      return action.yes
        ? { desk: { ...desk, founderOpen: false, panel: "intro", beat: "interested", stage: "connected" }, effect: { type: "advance", to: "connected" } }
        : { desk: { ...desk, founderOpen: false, panel: null, beat: "notNow", stage: "requested" }, effect: { type: "pass", by: "founder" } };
    case "sendIntro":
      return request && status === "connected" && !request.introSent
        ? { desk: { ...desk, panel: "intro", beat: "introSent" }, effect: { type: "sendIntro" } }
        : refuse;
    case "twoWeeks":
      return !request || (status === "connected" && request.introSent)
        ? { desk: { ...desk, panel: "sample", beat: "twoWeeks", stage: "outcome", sampleSeen: true }, effect: null }
        : refuse;
    // A panel whose request left from under it (a candidate-side removal or pass): close it and read as untouched again.
    case "settle":
      return { desk: { ...desk, panel: null, founderOpen: false, beat: "arrive" }, effect: null };
    case "closePanel":
      return { desk: { ...desk, panel: null, founderOpen: false }, effect: null };
    case "selectStage":
      return { desk: { ...desk, stage: action.stage }, effect: null };
    case "arrived":
      return { desk: { ...desk, arrivedKey: action.key }, effect: null };
  }
}

export type DeskCard = SampleCard & { mine: boolean };

/** The sample cards by stage, with the visitor's own request first in its column. */
export function deskColumns(request: IntroRequest | null, firstName: string): Record<DeskStage, DeskCard[]> {
  const columns: Record<DeskStage, DeskCard[]> = { requested: [], withFounder: [], connected: [], tracking: [], outcome: [] };
  const stage = stageOf(request);
  if (request && stage) {
    columns[stage].push({
      id: "mine",
      firstName,
      company: request.match.company.name,
      role: request.match.role?.title ?? "",
      stage,
      pill: "",
      mine: true,
    });
  }
  for (const sample of DESK_SAMPLES) columns[sample.stage].push({ ...sample, mine: false });
  return columns;
}
