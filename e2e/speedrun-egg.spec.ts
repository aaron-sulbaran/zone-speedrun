import { speedrunCopy } from "../lib/content";
import { test, expect } from "./support/fixtures";
import { playSwitch } from "./speedrun-flow";

const COPY = speedrunCopy.egg;

test("typing sux on Act 2 opens the placeholder, and Escape closes it and returns focus", async ({ page }) => {
  await page.goto("/speedrun");
  const dialog = page.locator("[data-egg]");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await playSwitch(page);
  const opener = page.locator("#join");
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
  await playSwitch(page);
  const logo = page.locator("#join").getByRole("img", { name: speedrunCopy.logoAlt });
  await logo.scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) await logo.click();
  await expect(page.locator("[data-egg]")).toBeHidden();
  await logo.click();
  await expect(page.locator("[data-egg]")).toBeVisible();
  await page.locator("[data-egg]").getByRole("button", { name: COPY.close }).click();
  await expect(page.locator("[data-egg]")).toBeHidden();
});

// Catches: the typing-target guard lapsing, so a visitor typing the word into a form field gets the egg instead of their text.
test("typing sux inside a text field does not open it", async ({ page }) => {
  await page.goto("/speedrun");
  await playSwitch(page);
  const field = page.locator("#join").getByLabel(speedrunCopy.join.steps.name.inputLabel);
  await field.click();
  await page.keyboard.type("sux");
  await expect(field).toHaveValue("sux");
  await expect(page.locator("[data-egg]")).toBeHidden();
});

test("typing sux on the opener (Act 1) does not open it", async ({ page }) => {
  await page.goto("/speedrun");
  await expect(page.locator('section[data-act="1"]')).toBeVisible();
  await page.keyboard.type("sux");
  await expect(page.locator("[data-egg]")).toHaveCount(0);
  // The negative proves itself: the same keys open it once the join phase is on screen.
  await playSwitch(page);
  await page.locator("#join").focus();
  await page.keyboard.type("sux");
  await expect(page.locator("[data-egg]")).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the placeholder appears with no animation", async ({ page }) => {
    await page.goto("/speedrun");
    await playSwitch(page);
    await page.locator("#join").focus();
    await page.keyboard.type("sux");
    const dialog = page.locator("[data-egg]");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.getAnimations().length)).toBe(0);
  });
});
