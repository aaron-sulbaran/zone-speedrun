import { speedrunCopy } from "../lib/content";
import { test, expect } from "./support/fixtures";

test("renders logged out with noindex and the affiliation line", async ({ page }) => {
  const response = await page.goto("/speedrun");
  expect(response?.status()).toBe(200);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(speedrunCopy.affiliation).first()).toBeVisible();

  const logo = page.getByRole("img", { name: speedrunCopy.logoAlt }).first();
  await expect(logo).toHaveAttribute("alt", /\S/);

  await page.getByRole("button", { name: "Open menu" }).click();
  const panel = page.getByRole("dialog", { name: "Site menu" });
  // Off the home page the menu's Home item is the way back to "/".
  await panel.getByRole("link", { name: /Home/ }).click();
  await page.waitForURL((url) => url.pathname === "/");
});
