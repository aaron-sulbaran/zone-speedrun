import { speedrunCopy } from "../lib/content";
import { PEOPLE } from "../lib/speedrun/people";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";

async function joinAs(page: Page, key: "sam" | "dev") {
  await page.goto("/speedrun");
  const card = page.locator("#join");
  await card.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
  await card.locator(`[data-person="${key}"]`).click();
  await card.getByRole("button", { name: speedrunCopy.join.finish }).click();
}

test("Sam sees the build log, the made-for beat, then matches with reasons", async ({ page }) => {
  await joinAs(page, "sam");
  const visible = page.locator("[data-build-visible]");
  const targets = PEOPLE.sam.intake.targets.map((t) => speedrunCopy.matches.fnLabels[t]);
  await expect(visible).toContainText(new RegExp(targets.join("|")));
  await expect(page.locator("[data-made-for]")).toContainText("made for Sam", { timeout: 12_000 });
  const cards = page.locator("[data-match-card]");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  await expect(cards.first().locator("li").first()).not.toBeEmpty();

  await cards.first().getByRole("button", { name: speedrunCopy.matches.connect.follow }).click();
  await expect(page.locator("[data-connect-sheet=follow]")).toContainText(speedrunCopy.matches.connectSheet.follow);
  await page.getByRole("button", { name: speedrunCopy.matches.connect.intro }).first().click();
  await expect(page.locator("[data-connect-sheet=intro]")).toContainText(speedrunCopy.matches.connectSheet.intro);
});

test("Dev sees the founder card with both links", async ({ page }) => {
  await joinAs(page, "dev");
  const founder = page.locator("[data-founder-route]");
  await expect(founder).toBeVisible({ timeout: 20_000 });
  await expect(founder.getByRole("link", { name: speedrunCopy.matches.founder.speedrun })).toHaveAttribute("target", "_blank");
  await expect(founder.getByRole("link", { name: speedrunCopy.matches.founder.alpha })).toBeVisible();
});

test("Skip jumps straight to the matches", async ({ page }) => {
  await joinAs(page, "sam");
  await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
  await expect(page.locator("[data-match-card]").first()).toBeVisible({ timeout: 3000 });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the matches appear without waiting out the log", async ({ page }) => {
    await joinAs(page, "sam");
    await expect(page.locator("[data-match-card]").first()).toBeVisible({ timeout: 3000 });
  });
});
