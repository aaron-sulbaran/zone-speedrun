import { speedrunCopy } from "@/lib/content";
import type { DemoState } from "@/lib/speedrun/demoState";
import { displayName } from "@/lib/speedrun/onboarding";
import { PEOPLE } from "@/lib/speedrun/people";

type NameState = Pick<DemoState, "answers" | "personKey" | "profile">;

/** The name every greeting uses: what they typed, else the sample person's, else "you". */
export function visitorName(state: NameState): string {
  return visitorFirstName(state) ?? speedrunCopy.phases.nameFallback;
}

/** The typed or sample name with no fallback, for the account button's initial. */
export function visitorFirstName(state: NameState): string | null {
  const sampleOwner = state.personKey ? PEOPLE[state.personKey].profile.firstName : null;
  return displayName(state.answers, sampleOwner ?? state.profile?.firstName ?? null, "") || null;
}
