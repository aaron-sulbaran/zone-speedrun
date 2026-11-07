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

test.describe("act 2 join card", () => {
  test("Enter advances the join steps", async ({ page }) => {
    await page.goto("/speedrun");
    const card = page.locator("#join");
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole("heading", { name: speedrunCopy.join.steps.targets.question })).toBeVisible();
    await card.getByRole("button", { name: speedrunCopy.join.targetLabels.design }).click();
    await page.keyboard.press("Enter");
    await expect(card.getByRole("heading", { name: speedrunCopy.join.steps.places.question })).toBeVisible();
    await card.getByRole("button", { name: "Remote" }).click();
    await page.keyboard.press("Enter");
    await expect(card.getByRole("heading", { name: speedrunCopy.join.steps.why.question })).toBeVisible();
    await expect(card.getByLabel(speedrunCopy.join.steps.why.inputLabel)).toBeFocused();
    await page.keyboard.type("Build things.");
    await page.keyboard.press("Enter");
    await expect(card.getByRole("heading", { name: speedrunCopy.join.steps.resume.question })).toBeVisible();
    await expect(card.getByText(speedrunCopy.join.nothingSent)).toBeVisible();
    await expect(card.locator('[data-affiliation="inline"]')).toBeVisible();
  });

  test("the whole card works by keyboard alone", async ({ page }) => {
    await page.goto("/speedrun");
    const card = page.locator("#join");
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: speedrunCopy.join.targetLabels.engineering }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    const heading = (question: string) => card.getByRole("heading", { name: question });
    await expect(heading(speedrunCopy.join.steps.places.question)).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await expect(heading(speedrunCopy.join.steps.why.question)).toBeVisible();
    await expect(card.getByLabel(speedrunCopy.join.steps.why.inputLabel)).toBeFocused();
    await page.keyboard.type("Build.");
    await page.keyboard.press("Enter");
    await expect(heading(speedrunCopy.join.steps.resume.question)).toBeFocused();
    await expect(card.getByText(/^Step 4 of 4\./)).toBeAttached();
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowRight");
    await expect(card.locator('[data-person="maya"]')).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-demo]")).toHaveAttribute("data-step", /^(building|ready)$/);
  });

  test("pick a sample person reaches the board", async ({ page }) => {
    await page.goto("/speedrun");
    const card = page.locator("#join");
    await card.scrollIntoViewIfNeeded();
    for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
    await card.locator('[data-person="dev"]').click();
    await card.getByRole("button", { name: speedrunCopy.join.finish }).click();
    await expect(page.locator("[data-demo]")).toHaveAttribute("data-step", /^(building|ready)$/);
    await expect(page.locator("[data-demo]")).toHaveAttribute("data-step", "ready", { timeout: 10_000 });
  });
});

for (const key of ["sam", "maya"] as const) {
  test(`no horizontal scroll at 390 after picking ${key}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/speedrun");
    const card = page.locator("#join");
    await card.scrollIntoViewIfNeeded();
    for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
    await card.locator(`[data-person="${key}"]`).click();
    await card.getByRole("button", { name: speedrunCopy.join.connect.gmail }).click();
    await card.getByRole("button", { name: speedrunCopy.join.finish }).click();
    await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
    await expect(page.locator("[data-brief]")).toBeAttached({ timeout: 20_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test("the decisions and the close are on the page", async ({ page }) => {
  await page.goto("/speedrun");
  const section = page.locator("[data-decisions]");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("heading", { name: speedrunCopy.decisions.heading })).toBeVisible();
  await expect(section.locator("[data-decision-card]")).toHaveCount(6);
  const links = page.locator("[data-close] a");
  await expect(links.nth(0)).toHaveAttribute("href", "/");
  await expect(links.nth(1)).toHaveAttribute("href", "/quick");
  await expect(links.nth(2)).toHaveAttribute("href", "https://www.linkedin.com/in/aaron-sulbaran/");
  await expect(links.nth(2)).toHaveAttribute("target", "_blank");
});

test("the sitemap leaves /speedrun out", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();
  expect(body).not.toContain("speedrun");
});
