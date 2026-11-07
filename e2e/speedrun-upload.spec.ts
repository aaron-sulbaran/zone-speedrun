import { speedrunCopy } from "../lib/content";
import { rankMatches } from "../lib/speedrun/match";
import { pdfWith } from "../lib/speedrun/pdfFixture";
import { PEOPLE } from "../lib/speedrun/people";
import { getSnapshot } from "../lib/speedrun/snapshot";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";

// Needs its own server started with SPEEDRUN_AI=on and no AI Gateway credentials
// (E2E_BASE_URL points at it). The read route is intercepted in the browser, so
// no request reaches the model or the gateway even if a credential were present.
test.skip(!process.env.E2E_BASE_URL, "needs E2E_BASE_URL pointing at a server started with SPEEDRUN_AI=on");

const FICTIONAL_RESUME = "Ada Example, software engineer. SKILLS TypeScript, React, Postgres. Built a fictional billing tool.";

async function openResumeStep(page: Page) {
  await page.goto("/speedrun");
  const card = page.locator("#join");
  await card.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
  return card;
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

  await expect(page.locator("[data-match-card]").first()).toBeVisible({ timeout: 20_000 });
  expect(posts).toHaveLength(1);
  expect(posts[0].text).toContain("Ada Example, software engineer");
  expect(posts[0].file).toBeUndefined();
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
