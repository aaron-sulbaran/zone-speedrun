import { defineConfig, devices } from "@playwright/test";

// The end to end suite (e2e/). It runs against a local production build only,
// never the dev server, a Vercel preview or the production domain. The app serves
// under basePath /speedrun, so the tests navigate to "/speedrun".
//
// E2E_BASE_URL points the suite at another local build; the suite then starts no
// server of its own.

const CI = !!process.env.CI;
const PORT = Number(process.env.E2E_PORT ?? 3290);
const OTHER_BUILD = process.env.E2E_BASE_URL;
if (OTHER_BUILD && !/^http:\/\/localhost:\d+\/?$/.test(OTHER_BUILD)) throw new Error("E2E_BASE_URL must be a localhost URL");
const BASE_URL = OTHER_BUILD ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        baseURL: BASE_URL,
        launchOptions: { args: ["--mute-audio"] },
      },
    },
  ],
  webServer: OTHER_BUILD
    ? []
    : [
        {
          command: `pnpm build && pnpm start -p ${PORT}`,
          url: `${BASE_URL}/speedrun`,
          reuseExistingServer: !CI,
          timeout: 240_000,
          stdout: "ignore",
          stderr: "pipe",
        },
      ],
});
