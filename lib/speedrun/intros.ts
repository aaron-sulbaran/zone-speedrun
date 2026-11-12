import type { CompanyDetail } from "./details";

// How an intro reads, for the brief's words and the actions' kinds alike. No content imports, so the brief's API route can use it.

type Details = Record<string, CompanyDetail> | undefined;

const DAY_MS = 86_400_000;
/** An intro nobody has answered in this many days is followed up. */
export const QUIET_INTRO_DAYS = 5;

const dayOf = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
export const daysFrom = (iso: string, today: string) => Math.max(0, dayOf(today) - dayOf(iso));

/** A detail about one role applies to that role only; one with no role covers the company or the intro. */
export function detailFor(details: Details, company: string, role: string | null): CompanyDetail | undefined {
  const detail = details?.[company];
  return detail && (!detail.role || detail.role === role) ? detail : undefined;
}

/** These events are introductions, not replies, so an intro is "waiting" until its detail says otherwise. */
export function introStatusOf(detail: CompanyDetail | undefined): "replied" | "scheduled" | "waiting" {
  return detail?.introStatus === "replied" || detail?.introStatus === "scheduled" ? detail.introStatus : "waiting";
}

/** What a brief line about an intro says: the founder wrote back, the intro has gone quiet, or nothing worth a line. */
export function introLineKind(details: Details, company: string, date: string, today: string): "replied" | "quiet" | null {
  const status = introStatusOf(detailFor(details, company, null));
  if (status === "replied") return "replied";
  return status === "waiting" && daysFrom(date, today) >= QUIET_INTRO_DAYS ? "quiet" : null;
}
