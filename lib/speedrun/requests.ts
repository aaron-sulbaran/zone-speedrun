import { MAX_PLACES } from "./demoState";
import type { Intake, PersonKey } from "./types";

/** The JSON the demo posts to the match route: an Intake and a sample person, never the visitor's name. */
export function matchRequestBody(intake: Intake, personKey: PersonKey): string {
  return JSON.stringify({ intake: { ...intake, places: intake.places.slice(0, MAX_PLACES) }, personKey });
}
