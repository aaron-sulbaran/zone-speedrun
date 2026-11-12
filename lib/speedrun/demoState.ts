import type { MatchResult } from "./match";
import { PEOPLE } from "./people";
import { EMPTY_ANSWERS, stepsFor, toIntake, type Answers } from "./onboarding";
import type { IntroRequest } from "./introRequest";
import type { BoardCard, InboxEvent, Intake, PersonKey, Profile, ReadError } from "./types";

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
  events: InboxEvent[];
  /** matchKeys the visitor brought forward, in order. */
  shortlist: string[];
  introRequest: IntroRequest | null;
  /** Ids of next steps marked done. */
  done: string[];
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
  | { type: "addEvents"; events: InboxEvent[] }
  | { type: "bringForward"; key: string; on: boolean }
  | { type: "moveShortlist"; key: string; direction: -1 | 1 }
  | { type: "requestIntro"; request: IntroRequest }
  | { type: "swapIntro"; request: IntroRequest }
  | { type: "markDone"; id: string }
  | { type: "reset" };

export const MAX_PLACES = 8;

/** The Board renders its cards in this order until it is rebuilt. */
export const DEFAULT_BOARD_ORDER: BoardCard[] = ["today", "pipeline", "flow", "intros", "tools"];

const NO_PICKS = { shortlist: [] as string[], introRequest: null, done: [] as string[] };

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
    events: [],
    shortlist: [],
    introRequest: null,
    done: [],
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

/** Sets the shortlist and keeps the request's `ranked` in step with it. */
function withShortlist(state: DemoState, shortlist: string[]): DemoState {
  const request = state.introRequest;
  return { ...state, shortlist, introRequest: request ? { ...request, ranked: rankedFor(request.matchKey, shortlist) } : null };
}

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
        events: [],
        uploadError: null,
      };
    }
    // The file is being read: no sample person, and the response fills the profile and result.
    case "uploaded":
      return { ...state, step: "building", buildId: action.buildId, personKey: null, profile: null, result: null, ...NO_PICKS, events: [], uploadError: null };
    case "uploadFailed":
      return state.step === "building" && state.personKey === null && action.buildId === state.buildId ? { ...state, step: "join", uploadError: action.error } : state;
    case "uploadRejected":
      // The id moves so the card's per-failure key changes even when the same error repeats.
      return state.step === "join" ? { ...state, buildId: state.buildId + 1, uploadError: action.error } : state;
    case "built":
      if (state.step !== "building" || action.buildId !== state.buildId) return state;
      return { ...state, step: "ready", profile: action.profile, result: action.result, ...NO_PICKS };
    case "addEvents":
      return { ...state, events: [...state.events, ...action.events] };
    case "bringForward": {
      const has = state.shortlist.includes(action.key);
      if (action.on === has) return state;
      if (action.on) return withShortlist(state, [...state.shortlist, action.key]);
      // Taking the requested match off the shortlist withdraws the request with it.
      const requestGone = state.introRequest?.matchKey === action.key;
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
    // One request at a time, and only on a match that is on the shortlist.
    case "requestIntro":
      if (state.introRequest !== null || !state.shortlist.includes(action.request.matchKey)) return state;
      return withShortlist({ ...state, introRequest: action.request }, state.shortlist);
    // The swap moves the pick to #1 and the request with it, and only while the talent team has not picked it up.
    case "swapIntro":
      if (state.introRequest?.status !== "requested" || !state.shortlist.includes(action.request.matchKey)) return state;
      return withShortlist({ ...state, introRequest: action.request }, [action.request.matchKey, ...state.shortlist.filter((key) => key !== action.request.matchKey)]);
    case "markDone":
      return state.done.includes(action.id) ? state : { ...state, done: [...state.done, action.id] };
    case "reset":
      return { ...initialDemoState(state.live), buildId: state.buildId + 1 };
  }
}
