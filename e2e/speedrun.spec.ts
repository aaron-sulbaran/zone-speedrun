import { speedrunCopy } from "../lib/content";
import { test, expect } from "./support/fixtures";

test("renders logged out with noindex and the affiliation line", async ({ page }) => {
  const response = await page.goto("/speedrun");
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(speedrunCopy.meta.title);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/);
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
  await expect(page.locator("#act-2")).toBeFocused({ timeout: 2000 });
  await page.waitForTimeout(2500);
  expect(await page.locator("[data-shift-strip]").isHidden()).toBe(true);
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

test.describe("short viewport", () => {
  test.use({ viewport: { width: 1440, height: 400 } });
  test("replay waits for the cover, returns to the turn line and re-arms the button", async ({ page }) => {
    await page.goto("/speedrun");
    const turn = page.getByText(speedrunCopy.shift.turnLine1);
    const button = page.getByRole("button", { name: speedrunCopy.shift.button });
    const replay = page.getByRole("button", { name: speedrunCopy.shift.replay });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(turn).not.toBeInViewport();
    await page.evaluate(() => document.getElementById("main")?.scrollIntoView({ block: "start" }));
    await button.click();
    await expect(replay).toHaveCount(0);
    await expect(page.locator("#act-2")).toBeFocused({ timeout: 2000 });
    await expect(replay).toBeVisible();
    await expect(turn).not.toBeInViewport();
    await replay.click();
    await expect(turn).toBeInViewport();
    await expect(button).toBeEnabled();
  });
});

test("act 1 shows the headline, the applications stat and a flow chart", async ({ page }) => {
  await page.goto("/speedrun");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(speedrunCopy.act1.headline1);
  await expect(page.locator('[data-funnel-stat="applications"]')).toHaveText("84");
  const links = page.locator('[data-act="1"] svg path.flow-link');
  expect(await links.count()).toBeGreaterThanOrEqual(8);
});
