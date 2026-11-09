import { speedrunCopy } from "@/lib/content";
import type { DemoState } from "@/lib/speedrun/demoState";
import { displayName } from "@/lib/speedrun/onboarding";
import { PEOPLE } from "@/lib/speedrun/people";

/** The first name every greeting uses: what they typed, else the sample person's, else "you". */
export function visitorName(state: Pick<DemoState, "answers" | "personKey" | "profile">): string {
  const sampleOwner = state.personKey ? PEOPLE[state.personKey].profile.firstName : null;
  return displayName(state.answers, sampleOwner ?? state.profile?.firstName ?? null, speedrunCopy.phases.nameFallback);
}
