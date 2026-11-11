import { speedrunCopy } from "../lib/content";
import { rankMatches } from "../lib/speedrun/match";
import { pdfWith } from "../lib/speedrun/pdfFixture";
import { PEOPLE } from "../lib/speedrun/people";
import { getSnapshot } from "../lib/speedrun/snapshot";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, skipBuildLog } from "./speedrun-flow";

// Needs a server built with SPEEDRUN_AI=on and a dummy store pair (a fake https:// KV_REST_API_URL and
// KV_REST_API_TOKEN), so the upload step shows (E2E_BASE_URL points at it).
// The request intercept below is what keeps this spec offline and spend-free: the read route never reaches
// the server. Unsetting env would not do that, because @vercel/oidc can mint a gateway token from the CLI
// login through the repo's .vercel folder.
test.skip(process.env.E2E_SPEEDRUN_AI !== "1", "needs E2E_SPEEDRUN_AI=1 and E2E_BASE_URL pointing at a server built with SPEEDRUN_AI=on and a dummy store pair (fake https:// KV_REST_API_URL and KV_REST_API_TOKEN)");

const FICTIONAL_RESUME = "Ada Example, software engineer. SKILLS TypeScript, React, Postgres. Built a fictional billing tool.";

const TYPED_NAME = "Zephyrine";

async function openResumeStep(page: Page) {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: TYPED_NAME, stopAtResume: true });
  return page.locator("#join");
}

test("a PDF is read in the browser, only its text is posted, and the board builds from the answer", async ({ page }) => {
  const posts: { text: string; intake: unknown; file?: unknown }[] = [];
  await page.route("**/speedrun/api/read", async (route) => {
    posts.push(route.request().postDataJSON());
    const { profile, intake } = PEOPLE.sam;
    await route.fulfill({ json: { profile, result: rankMatches(profile, intake, getSnapshot()), mode: "model" } });
  });

  const card = await openResumeStep(page);
  await expect(card).toContainText(speedrunCopy.join.steps.resume.uploadNotice);
  await card.locator("input[type=file]").setInputFiles({
    name: "cv.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfWith(FICTIONAL_RESUME)),
  });

  await skipBuildLog(page);
  await expect(page.locator("[data-match-row]").first()).toBeVisible({ timeout: 20_000 });
  expect(posts).toHaveLength(1);
  expect(posts[0].text).toContain("Ada Example, software engineer");
  expect(posts[0].file).toBeUndefined();
  expect(JSON.stringify(posts[0]).toLowerCase()).not.toContain(TYPED_NAME.toLowerCase());
  expect(Object.keys(posts[0]).sort()).toEqual(["intake", "text"]);
});

test("a PDF with no text layer is answered in the browser: no request, and the message takes focus", async ({ page }) => {
  let posted = 0;
  await page.route("**/speedrun/api/read", async (route) => {
    posted += 1;
    await route.abort();
  });

  const card = await openResumeStep(page);
  await card.locator("input[type=file]").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdfWith("")) });

  const alert = card.getByRole("alert");
  await expect(alert).toHaveText(speedrunCopy.join.steps.resume.uploadErrors.unreadable);
  await expect(alert).toBeFocused();
  expect(posted).toBe(0);
});
