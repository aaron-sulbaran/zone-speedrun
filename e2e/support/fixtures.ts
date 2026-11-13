import { test as base, expect, type Page } from "@playwright/test";
import { INBOX_TODAY } from "../../lib/speedrun/inbox";

// The suite's test object. Every page is held to the local server: a request
// to any other host is aborted and recorded, and a test that tried to reach
// Vercel or the production domain fails.

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;
const FORBIDDEN = /vercel|aaronsulbaran\.com/i;

type Fixtures = {
  offsite: string[];
};

/**
 * Pins the page's "now" to local noon of `day` (the demo's dates follow the visitor's today). Call it first in a test whose
 * assertions read a demo date; every other test keeps the real clock. setFixedTime freezes Date.now, which skews hero and
 * switch timings (a frozen clock broke the intro-replay and switch-floor pins), so pin only where a date is asserted.
 */
export async function pinToday(page: Page, day: string = INBOX_TODAY) {
  await page.context().clock.setFixedTime(new Date(`${day}T12:00:00`));
}

export const test = base.extend<Fixtures>({
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
