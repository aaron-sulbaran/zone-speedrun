import type { MatchResult } from "./match";
import { PEOPLE } from "./people";
import { EMPTY_ANSWERS, stepsFor, toIntake, type Answers } from "./onboarding";
import { founderYes, isLive, markIntroSent, pass, resolveShortlist, sendToFounder, type IntroRequest, type PassedBy } from "./introRequest";
import type { Intake, PersonKey, Profile, ReadError } from "./types";

export type UploadErrorKey = ReadError | "network";

export type Live = { reading: boolean; email: boolean };

export type DemoState = {
  step: "join" | "building" | "ready";
  /** An index into stepsFor(answers). */
  joinStep: number;
  /** What the visitor typed and picked; never overwritten by a sample person. */
  answers: Answers;
  /** Bumped by every new build, so a late response from an old one is ignored. */
  buildId: number;
  /** What the match uses: the visitor's answers, or the picked person's own when none were given. */
  intake: Intake;
  inboxConnected: boolean;
  calendarConnected: boolean;
  personKey: PersonKey | null;
  profile: Profile | null;
  result: MatchResult | null;
  /** matchKeys the visitor brought forward, in order. */
  shortlist: string[];
  introRequest: IntroRequest | null;
  /** Matches the team or the founder passed; a request never goes back to one. */
  passed: { key: string; by: PassedBy }[];
  /** Ids of next steps marked done. */
  done: string[];
  /** The time tapped on a Pick a time sheet, by action id, so every done marker names the same one. */
  picked: Record<string, string>;
  live: Live;
  /** Why the last upload failed; cleared by the next pick, upload or reset. */
  uploadError: UploadErrorKey | null;
};

export type DemoAction =
  | { type: "answer"; patch: Partial<Answers> }
  | { type: "connectInbox"; on: boolean }
  | { type: "connectCalendar"; on: boolean }
  | { type: "next" }
  | { type: "back" }
  | { type: "pickPerson"; key: PersonKey }
  | { type: "uploaded"; buildId: number }
  | { type: "uploadFailed"; buildId: number; error: UploadErrorKey }
  /** The browser refused the file before any build began. */
  | { type: "uploadRejected"; error: UploadErrorKey }
  | { type: "built"; buildId: number; profile: Profile; result: MatchResult }
  | { type: "bringForward"; key: string; on: boolean }
  | { type: "moveShortlist"; key: string; direction: -1 | 1 }
  | { type: "requestIntro"; request: IntroRequest }
  | { type: "swapIntro"; request: IntroRequest }
  | { type: "advanceIntro"; to: "withFounder" | "connected" }
  | { type: "sendIntro" }
  | { type: "passIntro"; by: PassedBy }
  | { type: "markDone"; id: string; slot?: string }
  | { type: "reset" };

export const MAX_PLACES = 8;

const NO_PICKS = { shortlist: [] as string[], introRequest: null, passed: [] as { key: string; by: PassedBy }[], done: [] as string[], picked: {} as Record<string, string> };

export function initialDemoState(live: Live): DemoState {
  return {
    step: "join",
    joinStep: 0,
    answers: { ...EMPTY_ANSWERS },
    buildId: 0,
    intake: toIntake(EMPTY_ANSWERS),
    inboxConnected: false,
    calendarConnected: false,
    personKey: null,
    profile: null,
    result: null,
    shortlist: [],
    introRequest: null,
    passed: [],
    done: [],
    picked: {},
    live,
    uploadError: null,
  };
}

function hasAnswers(answers: Answers) {
  return (
    answers.targets.length > 0 ||
    answers.places.length > 0 ||
    answers.why.trim().length > 0 ||
    answers.student !== null ||
    answers.founding !== null
  );
}

function clampStep(answers: Answers, joinStep: number) {
  return Math.max(0, Math.min(stepsFor(answers).length - 1, joinStep));
}

/** The request's key first, then the live shortlist in order (Ruling 45's `ranked`). */
const rankedFor = (requestKey: string, shortlist: string[]) => [requestKey, ...shortlist.filter((key) => key !== requestKey)];

const toFront = (key: string, shortlist: string[]) => [key, ...shortlist.filter((other) => other !== key)];

/** Sets the shortlist and keeps the request's `ranked` in step with it. */
function withShortlist(state: DemoState, shortlist: string[]): DemoState {
  const request = state.introRequest;
  return { ...state, shortlist, introRequest: request ? { ...request, ranked: rankedFor(request.matchKey, shortlist) } : null };
}

const isPassed = (state: DemoState, key: string) => state.passed.some((p) => p.key === key);

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "answer": {
      const answers = { ...state.answers, ...action.patch };
      answers.places = answers.places.slice(0, MAX_PLACES);
      if (answers.student !== true) answers.arrangements = [];
      return { ...state, answers, joinStep: clampStep(answers, state.joinStep), intake: toIntake(answers) };
    }
    case "connectInbox":
      return { ...state, inboxConnected: action.on };
    case "connectCalendar":
      return { ...state, calendarConnected: action.on };
    case "next":
      return { ...state, joinStep: clampStep(state.answers, state.joinStep + 1) };
    case "back":
      return { ...state, joinStep: clampStep(state.answers, state.joinStep - 1) };
    case "pickPerson": {
      const person = PEOPLE[action.key];
      return {
        ...state,
        step: "building",
        buildId: state.buildId + 1,
        personKey: action.key,
        intake: hasAnswers(state.answers) ? toIntake(state.answers) : person.intake,
        profile: null,
        result: null,
        ...NO_PICKS,
        uploadError: null,
      };
    }
    // The file is being read: no sample person, and the response fills the profile and result.
    case "uploaded":
      return { ...state, step: "building", buildId: action.buildId, personKey: null, profile: null, result: null, ...NO_PICKS, uploadError: null };
    case "uploadFailed":
      return state.step === "building" && state.personKey === null && action.buildId === state.buildId ? { ...state, step: "join", uploadError: action.error } : state;
    case "uploadRejected":
      // The id moves so the card's per-failure key changes even when the same error repeats.
      return state.step === "join" ? { ...state, buildId: state.buildId + 1, uploadError: action.error } : state;
    case "built":
      if (state.step !== "building" || action.buildId !== state.buildId) return state;
      return { ...state, step: "ready", profile: action.profile, result: action.result, ...NO_PICKS };
    case "bringForward": {
      const has = state.shortlist.includes(action.key);
      if (action.on === has) return state;
      if (action.on && isPassed(state, action.key)) return state;
      if (action.on) return withShortlist(state, [...state.shortlist, action.key]);
      // Taking the requested match off the shortlist withdraws the request with it.
      const requestGone = state.introRequest?.matchKey === action.key;
      // The desk has moved it: only a request still at `requested` can be withdrawn.
      if (requestGone && state.introRequest?.status !== "requested") return state;
      return withShortlist({ ...state, introRequest: requestGone ? null : state.introRequest }, state.shortlist.filter((key) => key !== action.key));
    }
    case "moveShortlist": {
      const at = state.shortlist.indexOf(action.key);
      const to = at + action.direction;
      if (at < 0 || to < 0 || to >= state.shortlist.length) return state;
      const shortlist = [...state.shortlist];
      [shortlist[at], shortlist[to]] = [shortlist[to], shortlist[at]];
      return withShortlist(state, shortlist);
    }
    // One live request at a time (a passed one does not count), and only on a match that is on the shortlist.
    case "requestIntro":
      if (isLive(state.introRequest) || !state.shortlist.includes(action.request.matchKey) || isPassed(state, action.request.matchKey)) return state;
      return withShortlist({ ...state, introRequest: action.request }, state.shortlist);
    // The swap moves the pick to #1 and the request with it, and only while the talent team has not picked it up.
    case "swapIntro":
      if (state.introRequest?.status !== "requested" || !state.shortlist.includes(action.request.matchKey) || isPassed(state, action.request.matchKey)) return state;
      return withShortlist({ ...state, introRequest: action.request }, toFront(action.request.matchKey, state.shortlist));
    case "advanceIntro": {
      const request = state.introRequest;
      const next = request && (action.to === "withFounder" ? sendToFounder(request) : founderYes(request));
      return next ? { ...state, introRequest: next } : state;
    }
    case "sendIntro": {
      const next = state.introRequest && markIntroSent(state.introRequest);
      return next ? { ...state, introRequest: next } : state;
    }
    // The live request is found by its own key, never by shortlist position.
    case "passIntro": {
      const request = state.introRequest;
      if (!isLive(request) || !state.result) return state;
      const passed = [...state.passed, { key: request.matchKey, by: action.by }];
      const open = state.shortlist.filter((key) => !passed.some((p) => p.key === key));
      const { live } = pass(request, action.by, resolveShortlist(state.result, open), state.intake);
      // A passed key leaves the shortlist for good, so the pick is free to spend on another match.
      if (!live) return withShortlist({ ...state, passed, introRequest: null }, open);
      return withShortlist({ ...state, passed, introRequest: live }, toFront(live.matchKey, open));
    }
    case "markDone":
      if (state.done.includes(action.id)) return state;
      return { ...state, done: [...state.done, action.id], picked: action.slot ? { ...state.picked, [action.id]: action.slot } : state.picked };
    case "reset":
      return { ...initialDemoState(state.live), buildId: state.buildId + 1 };
  }
}
