import { speedrunCopy } from "@/lib/content";
import type { Beat } from "./desk";
import type { DeskStage } from "./deskSamples";

const { beats, noName } = speedrunCopy.team;

/** A visitor who typed no name and picked no sample reads as "this candidate", never as "you". */
export const deskFirstName = (firstName: string | null): string => firstName || noName;

/** The narration for a beat; with no live request, the untouched desk reads as the empty queue. */
export function narrationLine(beat: Beat, live: DeskStage | null, name: string): string {
  if (live === null && beat === "arrive") return beats.empty;
  switch (beat) {
    case "sentInstead":
      return beats.sentInstead(name);
    case "notNow":
      return beats.notNow(name);
    default:
      return beats[beat];
  }
}
