import { introEvents } from "./board";
import { composeBrief, type Brief, type BriefRole } from "./brief";
import { classifyEmail } from "./classify";
import { DETAILS } from "./details";
import { generateInbox, INBOX_TODAY } from "./inbox";
import { companyForRole, matchCompanyName, rankMatches, type MatchResult } from "./match";
import { PEOPLE } from "./people";
import { buildPipeline } from "./pipeline";
import { getSnapshot } from "./snapshot";
import type { InboxEvent, PersonKey } from "./types";

export const MAX_ROLE_IDS = 6;

/** Roles by id from the snapshot, in the order given. Unknown ids are dropped, so a request cannot invent a role. */
export function rolesFromIds(ids: string[]): BriefRole[] {
  const { roles, companies } = getSnapshot();
  const byId = new Map(roles.map((role) => [role.id, role]));
  return ids.slice(0, MAX_ROLE_IDS).flatMap((id) => {
    const role = byId.get(id);
    return role ? [{ ...role, companyName: matchCompanyName(role, companyForRole(role, companies)) }] : [];
  });
}

/** The ids the brief request carries: the top roles on the visitor's own matches. */
export function roleIdsOf(result: MatchResult): string[] {
  return result.matches.flatMap((match) => (match.role ? [match.role.id] : [])).slice(0, MAX_ROLE_IDS);
}

/** The events a brief reads: nothing without an inbox, otherwise the sample person's made-up inbox (if any). */
export function briefEvents(key: PersonKey | null, connected: boolean): InboxEvent[] {
  if (!connected || !key) return [];
  return generateInbox(PEOPLE[key]).map(classifyEmail);
}

type Options = { connected?: boolean; roleIds?: string[] };

/** A sample person's brief from their made-up inbox. Without `roleIds` it ranks with the person's own intake (tests only). */
export function sampleBrief(key: PersonKey, options: Options = {}): Brief {
  const person = PEOPLE[key];
  const connected = options.connected ?? true;
  const events = briefEvents(key, connected);
  const roleIds = options.roleIds ?? roleIdsOf(rankMatches(person.profile, person.intake, getSnapshot()));
  return composeBrief({
    personKey: key,
    firstName: person.profile.firstName,
    cadence: person.cadence,
    today: INBOX_TODAY,
    pipeline: buildPipeline(events, INBOX_TODAY),
    roles: rolesFromIds(roleIds),
    intros: introEvents(events).map((event) => ({ company: event.company, date: event.date })),
    details: DETAILS[key],
  });
}

/** The brief for someone who uploaded their own resume: no sample inbox, so nothing has moved. */
export function visitorBrief(firstName: string, roleIds: string[]): Brief {
  const events: InboxEvent[] = [];
  return composeBrief({
    firstName,
    cadence: "daily",
    today: INBOX_TODAY,
    pipeline: buildPipeline(events, INBOX_TODAY),
    roles: rolesFromIds(roleIds),
    intros: introEvents(events).map((event) => ({ company: event.company, date: event.date })),
  });
}
