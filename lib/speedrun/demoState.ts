import type { MatchResult } from "./match";
import { PEOPLE } from "./people";
import { EMPTY_ANSWERS, stepsFor, toIntake, type Answers } from "./onboarding";
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
  boardOrder: BoardCard[];
  hidden: BoardCard[];
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
  | { type: "uploaded" }
  | { type: "uploadFailed"; error: UploadErrorKey }
  | { type: "built"; buildId: number; profile: Profile; result: MatchResult }
  | { type: "addEvents"; events: InboxEvent[] }
  | { type: "moveCard"; card: BoardCard; to: number }
  | { type: "toggleCard"; card: BoardCard }
  | { type: "reset" };

export const MAX_PLACES = 8;

export const DEFAULT_BOARD_ORDER: BoardCard[] = ["today", "pipeline", "flow", "intros", "tools"];

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
    boardOrder: [...DEFAULT_BOARD_ORDER],
    hidden: [],
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
        boardOrder: [...person.boardOrder],
        hidden: [],
        events: [],
        uploadError: null,
      };
    }
    // The file is being read: no sample person, and the response fills the profile and result.
    case "uploaded":
      return { ...state, step: "building", buildId: state.buildId + 1, personKey: null, profile: null, result: null, boardOrder: [...DEFAULT_BOARD_ORDER], hidden: [], events: [], uploadError: null };
    case "uploadFailed":
      return state.step === "building" && state.personKey === null ? { ...state, step: "join", uploadError: action.error } : state;
    case "built":
      if (state.step !== "building" || action.buildId !== state.buildId) return state;
      return { ...state, step: "ready", profile: action.profile, result: action.result };
    case "addEvents":
      return { ...state, events: [...state.events, ...action.events] };
    case "moveCard": {
      if (!state.boardOrder.includes(action.card)) return state;
      const rest = state.boardOrder.filter((card) => card !== action.card);
      const to = Math.max(0, Math.min(rest.length, action.to));
      return { ...state, boardOrder: [...rest.slice(0, to), action.card, ...rest.slice(to)] };
    }
    case "toggleCard": {
      if (state.boardOrder.includes(action.card)) {
        return {
          ...state,
          boardOrder: state.boardOrder.filter((card) => card !== action.card),
          hidden: [...state.hidden, action.card],
        };
      }
      if (!state.hidden.includes(action.card)) return state;
      return {
        ...state,
        boardOrder: [...state.boardOrder, action.card],
        hidden: state.hidden.filter((card) => card !== action.card),
      };
    }
    case "reset":
      return { ...initialDemoState(state.live), buildId: state.buildId + 1 };
  }
}
