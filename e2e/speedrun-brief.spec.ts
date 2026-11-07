import { speedrunCopy } from "../lib/content";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";

const COPY = speedrunCopy.brief;

async function joinAs(page: Page, key: "sam" | "maya") {
  await page.goto("/speedrun");
  const card = page.locator("#join");
  await card.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
  await card.locator(`[data-person="${key}"]`).click();
  await card.getByRole("button", { name: speedrunCopy.join.connect.gmail }).click();
  await card.getByRole("button", { name: speedrunCopy.join.finish }).click();
  await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
  await expect(page.locator("[data-brief]")).toBeAttached({ timeout: 20_000 });
}

test("the brief previews as an email with the first name in its subject", async ({ page }) => {
  await joinAs(page, "sam");
  const subject = page.locator("[data-brief-subject]");
  await expect(subject).toContainText("Sam");
  await expect(subject).toHaveText(/things? moved overnight/);
  await expect(page.locator("[data-brief-item]").first()).toHaveAttribute("data-brief-item", "intro");
});

test("a quiet person gets the short brief", async ({ page }) => {
  await joinAs(page, "maya");
  await expect(page.locator("[data-brief-subject]")).toHaveText(COPY.quietSubject("Maya"));
  await expect(page.locator("[data-brief-quiet]")).toBeVisible();
});

test("with email off the page shows the off line and no address field", async ({ page }) => {
  await joinAs(page, "sam");
  await expect(page.locator("[data-brief-off]")).toHaveText(COPY.send.off);
  await expect(page.locator("[data-brief] input")).toHaveCount(0);
  await expect(page.locator("[data-brief-send]")).toHaveCount(0);
});
