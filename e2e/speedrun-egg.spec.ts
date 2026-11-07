import { speedrunCopy } from "../lib/content";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";

const COPY = speedrunCopy.egg;

async function reachPasteBox(page: Page) {
  await page.goto("/speedrun");
  const card = page.locator("#join");
  await card.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
  await card.locator('[data-person="sam"]').click();
  await card.getByRole("button", { name: speedrunCopy.join.finish }).click();
  await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
  await expect(page.locator("[data-board]")).toBeVisible({ timeout: 20_000 });
}

test("typing sux on Act 2 opens the placeholder, and Escape closes it and returns focus", async ({ page }) => {
  await page.goto("/speedrun");
  const dialog = page.locator("[data-egg]");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const opener = page.locator("#join");
  await opener.scrollIntoViewIfNeeded();
  await opener.focus();
  await page.keyboard.type("sux");
  await expect(page.getByRole("dialog", { name: COPY.label })).toBeVisible();
  await expect(dialog).toContainText(COPY.line1);
  await expect(dialog.getByRole("button", { name: COPY.close })).toBeFocused();
  await expect(dialog.locator("img")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("clicking the logo five times opens it, and the Close button closes it", async ({ page }) => {
  await page.goto("/speedrun");
  const logo = page.locator("#join").getByRole("img", { name: speedrunCopy.logoAlt });
  await logo.scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) await logo.click();
  await expect(page.locator("[data-egg]")).toBeHidden();
  await logo.click();
  await expect(page.locator("[data-egg]")).toBeVisible();
  await page.locator("[data-egg]").getByRole("button", { name: COPY.close }).click();
  await expect(page.locator("[data-egg]")).toBeHidden();
});

test("typing sux inside the paste box does not open it", async ({ page }) => {
  await reachPasteBox(page);
  const paste = page.getByLabel(speedrunCopy.board.paste.label);
  await paste.click();
  await page.keyboard.type("sux");
  await expect(paste).toHaveValue("sux");
  await expect(page.locator("[data-egg]")).toBeHidden();
});
