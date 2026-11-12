import { speedrunCopy } from "@/lib/content";
import type { Beat } from "./desk";
import type { DeskStage } from "./deskSamples";
import type { IntroRequest } from "./introRequest";

const { beats, noName } = speedrunCopy.team;

/** A visitor who typed no name and picked no sample reads as "this candidate", never as "you". */
export const deskFirstName = (firstName: string | null): string => firstName || noName;

/** The candidate on a request, as every panel names them. */
export const candidateName = (request: IntroRequest): string => deskFirstName(request.candidate.firstName.trim() || null);

// Beats that describe the live card. If the card is no longer at that stage (the request was removed or swapped on the
// candidate side), the desk reads as untouched; the other beats are results of the walk and stand on their own.
const NEEDS: Partial<Record<Beat, DeskStage>> = { review: "requested", sent: "withFounder", interested: "connected", introSent: "connected" };

/** The narration for a beat; with no live request, the untouched desk reads as the empty queue. */
export function narrationLine(shown: Beat, live: DeskStage | null, name: string, rival = ""): string {
  const needs = NEEDS[shown];
  const beat: Beat = needs && live !== needs ? "arrive" : shown;
  if (live === null && beat === "arrive") return beats.empty;
  switch (beat) {
    case "sentInstead":
      return beats.sentInstead(rival, name);
    case "notNow":
      return beats.notNow(name);
    default:
      return beats[beat];
  }
}
