import { MAX_PLACES } from "./demoState";
import type { Intake, PersonKey } from "./types";

/** The JSON the demo posts to the match route: an Intake and a sample person, never the visitor's name. */
export function matchRequestBody(intake: Intake, personKey: PersonKey): string {
  return JSON.stringify({ intake: { ...intake, places: intake.places.slice(0, MAX_PLACES) }, personKey });
}

/** The JSON the demo posts to the brief route: the address, a sample person and role ids, never the visitor's name. */
export function briefRequestBody({ email, personKey, connected, roleIds }: { email: string; personKey: PersonKey; connected: boolean; roleIds: string[] }): string {
  return JSON.stringify({ email, personKey, connected, roleIds });
}
