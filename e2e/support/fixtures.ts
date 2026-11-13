import { test as base, expect } from "@playwright/test";
import { INBOX_TODAY } from "../../lib/speedrun/inbox";

// The suite's test object. Every page is held to the local server: a request
// to any other host is aborted and recorded, and a test that tried to reach
// Vercel or the production domain fails.

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;
const FORBIDDEN = /vercel|aaronsulbaran\.com/i;

type Fixtures = {
  offsite: string[];
  pinnedClock: void;
};

type Options = {
  /** The calendar day the page believes it is, as YYYY-MM-DD; local noon of it. The demo's dates follow the visitor's today. null leaves the real clock alone. */
  today: string | null;
};

export const test = base.extend<Fixtures & Options>({
  today: [INBOX_TODAY, { option: true }],
  // setFixedTime moves "now" and leaves every timer running, so the pill auto-advance, the build log and the count-ups keep their real pace.
  pinnedClock: [
    async ({ context, today }, provide) => {
      if (today !== null) await context.clock.setFixedTime(new Date(`${today}T12:00:00`));
      await provide();
    },
    { auto: true },
  ],
  offsite: [
    async ({ context }, provide) => {
      const blocked: string[] = [];
      await context.route(
        (url) => !LOCAL.test(url.href) && url.protocol !== "data:" && url.protocol !== "blob:",
        (route) => {
          blocked.push(route.request().url());
          return route.abort("blockedbyclient");
        },
      );
      await provide(blocked);
      expect(blocked.filter((url) => FORBIDDEN.test(url)), "requests to Vercel or the production domain").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
