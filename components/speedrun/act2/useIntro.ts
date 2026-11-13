import { useMemo, type Dispatch } from "react";
import type { DemoAction, DemoState } from "@/lib/speedrun/demoState";
import { createRequest, swapRequest, type IntroRequest } from "@/lib/speedrun/introRequest";
import { eligible } from "@/lib/speedrun/introRequest";
import { introSlot } from "@/lib/speedrun/introSlot";
import type { Match } from "@/lib/speedrun/match";
import { matchKey } from "@/lib/speedrun/matchList";
import { visitorFirstName } from "../visitorName";
import type { MatchIntro } from "./MatchCard";

/** The profile fields a request carries; "sample" when a sample person was picked. */
function candidateFor(state: DemoState): IntroRequest["candidate"] {
  return {
    firstName: visitorFirstName(state) ?? state.profile?.firstName ?? "",
    headline: state.profile?.headline ?? "",
    shipped: state.profile?.shipped ?? [],
    kind: state.personKey ? "sample" : "visitor",
  };
}

/** Wires the shortlist and the one intro request to the matches on screen. */
export function useIntro(state: DemoState, dispatch: Dispatch<DemoAction>, onBoard: () => void) {
  const { shortlist, introRequest } = state;
  const shortlisted = useMemo(() => {
    const byKey = new Map((state.result?.matches ?? []).map((match) => [matchKey(match), match]));
    return shortlist.flatMap((key) => byKey.get(key) ?? []);
  }, [shortlist, state.result]);

  const bring = (key: string, on: boolean) => dispatch({ type: "bringForward", key, on });
  const rankOf = (key: string) => {
    const at = shortlist.indexOf(key);
    return at < 0 ? null : at + 1;
  };

  /** What one match's detail needs. */
  const forMatch = (match: Match): MatchIntro => {
    const key = matchKey(match);
    return {
      slot: introSlot(match, shortlist, introRequest, !shortlisted[0] || eligible(shortlisted[0])),
      onBoard,
      rank: rankOf(key),
      onBring: (on) => bring(key, on),
      onRequest: () => {
        const request = createRequest({ candidate: candidateFor(state), shortlist: shortlisted, intake: state.intake });
        if (request) dispatch({ type: "requestIntro", request });
      },
      onSwap: () => {
        if (!introRequest) return;
        const request = swapRequest(introRequest, match, shortlisted, state.intake);
        if (request) dispatch({ type: "swapIntro", request });
      },
    };
  };
  return { forMatch, rankOf, bring };
}
