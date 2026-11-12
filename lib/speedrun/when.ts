const SLOT_DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Mon, Nov 16": the day of a made-up time, read in UTC so it never depends on where the page runs. */
export const dayLabel = (date: Date) => SLOT_DAY.format(date);

/** "3:00 pm", with no time zone label: the times are fictional. */
export function clockLabel(date: Date): string {
  const hour = date.getUTCHours();
  return `${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** One format for every time the sheets show, the offered slots and a booked call alike. */
export const whenLabel = (iso: string) => `${dayLabel(new Date(iso))}, ${clockLabel(new Date(iso))}`;

const SHORT_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Nov 9": a table's date, read in UTC like every other made-up time. */
export const shortDay = (iso: string) => SHORT_DAY.format(new Date(iso));
