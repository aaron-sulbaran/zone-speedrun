import { introEvents } from "./board";
import { composeBrief, type Brief } from "./brief";
import { classifyEmail } from "./classify";
import { generateInbox, INBOX_TODAY } from "./inbox";
import { rankMatches, type MatchResult } from "./match";
import { PEOPLE } from "./people";
import { buildPipeline } from "./pipeline";
import { getSnapshot } from "./snapshot";
import type { InboxEvent, PersonKey } from "./types";

type Options = { connected?: boolean; extraEvents?: InboxEvent[]; result?: MatchResult };

/** A sample person's brief, built from their made-up inbox and the same matcher the page uses. */
export function sampleBrief(key: PersonKey, options: Options = {}): Brief {
  const person = PEOPLE[key];
  const connected = options.connected ?? true;
  const events = connected ? [...generateInbox(person).map(classifyEmail), ...(options.extraEvents ?? [])] : [];
  return composeBrief({
    personKey: key,
    firstName: person.profile.firstName,
    cadence: person.cadence,
    today: INBOX_TODAY,
    pipeline: buildPipeline(events, INBOX_TODAY),
    result: options.result ?? rankMatches(person.profile, person.intake, getSnapshot()),
    intros: introEvents(events).map((event) => event.company),
  });
}

/** The brief for someone who uploaded their own resume: no sample inbox, only what they pasted. */
export function visitorBrief(firstName: string, events: InboxEvent[], result: MatchResult): Brief {
  return composeBrief({
    firstName,
    cadence: "daily",
    today: INBOX_TODAY,
    pipeline: buildPipeline(events, INBOX_TODAY),
    result,
    intros: introEvents(events).map((event) => event.company),
  });
}
