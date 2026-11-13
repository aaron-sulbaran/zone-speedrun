const DAY_MS = 86_400_000;

/** The visitor's local calendar date as YYYY-MM-DD. Read it on the client only: the server renders no demo dates. */
export function demoToday(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const utcMidnight = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`);

/** The calendar day `offset` days after `day`, as YYYY-MM-DD. */
export function addDays(day: string, offset: number): string {
  return new Date(utcMidnight(day) + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, by calendar day. */
export const daysBetween = (from: string, to: string) => Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);

/** A made-up call `offset` days out at 15:00 UTC; a Saturday or Sunday moves to the Monday after. */
export function meetingOn(day: string, offset: number): string {
  let target = addDays(day, offset);
  const weekday = new Date(utcMidnight(target)).getUTCDay();
  if (weekday === 6) target = addDays(target, 2);
  if (weekday === 0) target = addDays(target, 1);
  return `${target}T15:00:00.000Z`;
}
