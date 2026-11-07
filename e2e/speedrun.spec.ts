import { speedrunCopy } from "../lib/content";
import { test, expect } from "./support/fixtures";

test("renders logged out with noindex and the affiliation line", async ({ page }) => {
  const response = await page.goto("/speedrun");
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(speedrunCopy.meta.title);
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);
  await expect(robots).toHaveAttribute("content", /nofollow/);
  await expect(page.getByText(speedrunCopy.affiliation).first()).toBeVisible();

  const logo = page.getByRole("img", { name: speedrunCopy.logoAlt }).first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Open menu" }).click();
  const panel = page.getByRole("dialog", { name: "Site menu" });
  // Off the home page the menu's Home item is the way back to "/".
  await panel.getByRole("link", { name: /Home/ }).click();
  await page.waitForURL((url) => url.pathname === "/");
});

async function expectShiftLands(page: import("@playwright/test").Page) {
  await page.goto("/speedrun");
  await expect(page.locator("#act-2")).toBeVisible();
  await page.getByRole("button", { name: speedrunCopy.shift.button }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const rect = document.getElementById("act-2")?.getBoundingClientRect();
          return !!rect && rect.top < window.innerHeight && rect.bottom > 0;
        }),
      { timeout: 2000 },
    )
    .toBe(true);
  await page.waitForTimeout(2500);
  await expect(page.locator("[data-shift-strip]")).toBeHidden();
  await expect(page.getByRole("button", { name: speedrunCopy.shift.replay })).toBeVisible();
}

test("the shift lands on act 2", async ({ page }) => {
  await expectShiftLands(page);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the shift lands on act 2", async ({ page }) => {
    await expectShiftLands(page);
  });
});

test("replay goes back to the turn line and re-arms the button", async ({ page }) => {
  await page.goto("/speedrun");
  const button = page.getByRole("button", { name: speedrunCopy.shift.button });
  await button.click();
  const replay = page.getByRole("button", { name: speedrunCopy.shift.replay });
  await expect(replay).toBeVisible({ timeout: 3000 });
  await expect(button).toBeEnabled({ timeout: 3000 });
  await replay.click();
  await expect(page.getByText(speedrunCopy.shift.turnLine1)).toBeInViewport();
  await expect(button).toBeEnabled();
});
