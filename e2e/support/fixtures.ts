import { test as base, expect } from "@playwright/test";

// The suite's test object. Every page is held to the local server: a request
// to any other host is aborted and recorded, and a test that tried to reach
// Vercel or the production domain fails.

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;
const FORBIDDEN = /vercel|aaronsulbaran\.com/i;

type Fixtures = {
  offsite: string[];
};

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
