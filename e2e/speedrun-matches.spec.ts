import { speedrunCopy } from "../lib/content";
import { PEOPLE } from "../lib/speedrun/people";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, openTab, skipBuildLog } from "./speedrun-flow";

const TAB = speedrunCopy.network.tabs;

// Answers as Sam does (product and engineering) so the log names the same targets; ends on the building phase.
async function joinAs(page: Page, key: "sam" | "dev") {
  await page.goto("/speedrun");
  await answerOnboarding(
    page,
    key === "sam"
      ? { name: "Sam", targets: ["product", "engineering"], places: ["New York", "Remote"], why: PEOPLE.sam.intake.why, person: "sam" }
      : { name: "Dev", targets: ["engineering", "founder"], founding: true, person: "dev" },
  );
}

async function toMatches(page: Page) {
  await skipBuildLog(page);
  await openTab(page, TAB.matches);
}

test("Sam sees the build log, the made-for beat, then matches with reasons", async ({ page }) => {
  await joinAs(page, "sam");
  const visible = page.locator("[data-build-visible]");
  const targets = PEOPLE.sam.intake.targets.map((t) => speedrunCopy.matches.fnLabels[t]);
  await expect(visible).toContainText(new RegExp(targets.join("|")));
  await expect(page.locator("[data-made-for]")).toContainText("made for Sam", { timeout: 12_000 });
  // The log ends by itself and the network follows, on the matches tab.
  const cards = page.locator("[data-match-card]");
  await expect(cards.first()).toBeVisible({ timeout: 25_000 });
  await expect(cards.first().locator("li").first()).not.toBeEmpty();

  await cards.first().getByRole("button", { name: speedrunCopy.matches.connect.follow }).click();
  await expect(page.locator("[data-connect-sheet=follow]")).toContainText(speedrunCopy.matches.connectSheet.follow);
  await page.getByRole("button", { name: speedrunCopy.matches.connect.intro }).first().click();
  await expect(page.locator("[data-connect-sheet=intro]")).toContainText(speedrunCopy.matches.connectSheet.intro);
});

test("Dev sees the founder card with both links", async ({ page }) => {
  await joinAs(page, "dev");
  await toMatches(page);
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
  test("the finished log is there without waiting, and Continue shows the matches", async ({ page }) => {
    await joinAs(page, "sam");
    await expect(page.locator("[data-made-for]")).toContainText("made for Sam", { timeout: 3000 });
    await page.getByRole("button", { name: speedrunCopy.build.continue }).click();
    await expect(page.locator("[data-match-card]").first()).toBeVisible({ timeout: 3000 });
  });
});

test("Apply opens the real role without agent tracking", async ({ page }) => {
  await joinAs(page, "sam");
  await toMatches(page);
  const apply = page.locator("[data-match-card]").getByRole("link", { name: speedrunCopy.matches.connect.apply, exact: true }).first();
  await expect(apply).toBeVisible();
  expect(await apply.getAttribute("href")).not.toContain("utm_medium=agent");
  await expect(apply).toHaveAttribute("rel", "noopener noreferrer");
  await expect(apply).toHaveAttribute("target", "_blank");
});

test("Escape closes the connect sheet and keeps focus on its button", async ({ page }) => {
  await joinAs(page, "sam");
  await toMatches(page);
  const follow = page.locator("[data-match-card]").first().getByRole("button", { name: speedrunCopy.matches.connect.follow });
  await follow.click();
  await expect(page.locator("[data-connect-sheet=follow]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-connect-sheet]")).toHaveCount(0);
  await expect(follow).toBeFocused();
});
