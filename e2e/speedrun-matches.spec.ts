import { speedrunCopy } from "../lib/content";
import { reasonLine } from "../lib/speedrun/matchList";
import type { MatchResult } from "../lib/speedrun/match";
import { PEOPLE } from "../lib/speedrun/people";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, networkHeading, openTab, skipBuildLog } from "./speedrun-flow";

const TAB = speedrunCopy.network.tabs;
const copy = speedrunCopy.matches;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

type Seen = { result: MatchResult | null };

/** Keeps the match response the page receives, and lets a test rewrite it before the page does. */
async function watchMatches(page: Page, rewrite?: (result: MatchResult) => MatchResult): Promise<Seen> {
  const seen: Seen = { result: null };
  await page.route("**/speedrun/api/match", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { profile: unknown; result: MatchResult };
    if (rewrite) body.result = rewrite(body.result);
    seen.result = body.result;
    await route.fulfill({ response, json: body });
  });
  return seen;
}

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

const rows = (page: Page) => page.locator("[data-match-row]");
const detail = (page: Page) => page.locator("[data-match-detail]");
const company = (row: Locator) => row.locator("[data-row-company]").innerText();

test("Sam sees the build log, the made-for beat, then a list of matches with reasons", async ({ page }) => {
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  const visible = page.locator("[data-build-visible]");
  const targets = PEOPLE.sam.intake.targets.map((t) => copy.fnLabels[t]);
  await expect(visible).toContainText(new RegExp(targets.join("|")));
  await expect(page.locator("[data-made-for]")).toContainText("made for Sam", { timeout: 12_000 });
  // The log ends by itself and the network follows, on the matches tab.
  await expect(rows(page).first()).toBeVisible({ timeout: 25_000 });
  const matches = seen.result!.matches;
  await expect(rows(page)).toHaveCount(matches.length);
  // Catches: a row that shows only a name, so the list says nothing about why.
  for (const [i, match] of matches.entries()) await expect(rows(page).nth(i)).toContainText(reasonLine(match));
  await expect(networkHeading(page)).toHaveText(copy.listHeading("Sam"));
  await expect(page.locator("[data-matches-count]")).toHaveText(copy.listCount(matches.length));
});

test("desktop: the first match is selected and its detail shows beside the list", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  const first = rows(page).first();
  // Catches: a list that opens with nothing selected, or a detail that waits for a click.
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(rows(page).nth(1)).not.toHaveAttribute("aria-current", "true");
  await expect(detail(page)).toBeVisible();
  await expect(detail(page).locator("[data-detail-heading]")).toHaveText(await company(first));
  await expect(page.locator("[data-detail-back]")).toBeHidden();
  // Clicking another row swaps the detail without a Back.
  await rows(page).nth(1).click();
  await expect(rows(page).nth(1)).toHaveAttribute("aria-current", "true");
  await expect(detail(page).locator("[data-detail-heading]")).toHaveText(await company(rows(page).nth(1)));
});

test("Up and Down move the selection and keep focus in the list", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  expect(await rows(page).count()).toBeGreaterThanOrEqual(4);
  await rows(page).first().click();
  // Catches: Up wrapping to the last row.
  await page.keyboard.press("ArrowUp");
  await expect(rows(page).first()).toHaveAttribute("aria-current", "true");
  await expect(rows(page).first()).toBeFocused();
  for (const [i] of [0, 1, 2].entries()) {
    await page.keyboard.press("ArrowDown");
    // Catches: focus left behind on the old row, or lost to the detail.
    await expect(rows(page).nth(i + 1)).toBeFocused();
    await expect(rows(page).nth(i + 1)).toHaveAttribute("aria-current", "true");
  }
  await expect(detail(page).locator("[data-detail-heading]")).toHaveText(await company(rows(page).nth(3)));
});

test("phone: a tap slides the detail in and focuses its heading; Back returns focus to the row", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  await expect(detail(page)).toBeHidden();
  const second = rows(page).nth(1);
  const name = await company(second);
  await second.click();
  await expect(detail(page)).toBeVisible();
  // Catches: the detail opening with focus still on the row behind it.
  await expect(detail(page).locator("[data-detail-heading]")).toBeFocused();
  await expect(detail(page).locator("[data-detail-heading]")).toHaveText(name);
  await page.locator("[data-detail-back]").click();
  await expect(detail(page)).toBeHidden();
  await expect(second).toBeFocused();
});

test("phone: Escape in the connect sheet closes only the sheet, a second Escape closes the detail", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  await rows(page).first().click();
  await expect(detail(page)).toBeVisible();
  const follow = detail(page).getByRole("button", { name: copy.connect.follow });
  await follow.click();
  await expect(page.locator("[data-connect-sheet=follow]")).toBeVisible();
  // Catches: a missing preventDefault in the sheet's handler, or a detail that ignores defaultPrevented.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-connect-sheet]")).toHaveCount(0);
  await expect(detail(page)).toBeVisible();
  await expect(follow).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(detail(page)).toBeHidden();
  await expect(rows(page).first()).toBeFocused();
});

test("a detail opened at 390 stays selected at 1440", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  const third = rows(page).nth(2);
  const name = await company(third);
  await third.click();
  await expect(detail(page)).toBeVisible();
  await page.setViewportSize(DESKTOP);
  // Catches: the two-pane view resetting to the first match when the layout widens.
  await expect(third).toHaveAttribute("aria-current", "true");
  await expect(detail(page)).toBeVisible();
  await expect(detail(page).locator("[data-detail-heading]")).toHaveText(name);
});

test("Dev sees the founder route row first, and its detail has both links", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "dev");
  await toMatches(page);
  const first = rows(page).first();
  await expect(first).toHaveAttribute("data-match-row", "founder", { timeout: 20_000 });
  await expect(first).toContainText(copy.founderRow);
  await expect(first).toContainText(copy.founder.mentioned);
  await expect(first).toHaveAttribute("aria-current", "true");
  const founder = detail(page).locator("[data-founder-route]");
  await expect(founder).toBeVisible();
  await expect(founder.getByRole("link", { name: copy.founder.speedrun })).toHaveAttribute("target", "_blank");
  await expect(founder.getByRole("link", { name: copy.founder.alpha })).toBeVisible();
});

test.describe("an empty result", () => {
  test.use({ viewport: DESKTOP });
  const noMatches = (result: MatchResult): MatchResult => ({ ...result, matches: [] });

  test("with no routes, the list and the detail both say so, and Up and Down do nothing", async ({ page }) => {
    await watchMatches(page, (result) => ({ ...noMatches(result), routes: [] }));
    await joinAs(page, "sam");
    await toMatches(page);
    await expect(page.locator("[data-matches-empty]")).toHaveText(copy.empty);
    await expect(page.locator("[data-detail-empty]")).toHaveText(copy.empty);
    await expect(rows(page)).toHaveCount(0);
    // Catches: an arrow key throwing or moving focus when there is nothing to select (Review Focus 5).
    await networkHeading(page).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(networkHeading(page)).toBeFocused();
    await expect(page.locator("[data-detail-heading]")).toHaveCount(0);
  });

  test("with founder routes, the list holds the founder row and the empty line, and Up and Down stay on it", async ({ page }) => {
    await watchMatches(page, noMatches);
    await joinAs(page, "dev");
    await toMatches(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toHaveAttribute("data-match-row", "founder");
    await expect(page.locator("[data-matches-empty]")).toHaveText(copy.empty);
    await expect(detail(page).locator("[data-founder-route]")).toBeVisible();
    await rows(page).first().click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(rows(page).first()).toBeFocused();
    await expect(rows(page).first()).toHaveAttribute("aria-current", "true");
  });
});

test("Skip jumps straight to the matches", async ({ page }) => {
  await joinAs(page, "sam");
  await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
  await expect(rows(page).first()).toBeVisible({ timeout: 3000 });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the finished log is there without waiting, Continue shows the matches, and the phone detail opens and closes without a slide", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await joinAs(page, "sam");
    await expect(page.locator("[data-made-for]")).toContainText("made for Sam", { timeout: 3000 });
    await page.getByRole("button", { name: speedrunCopy.build.continue }).click();
    await expect(rows(page).first()).toBeVisible({ timeout: 3000 });
    await rows(page).first().click();
    // Catches: a slide that still plays under reduced motion.
    const animations = await detail(page).evaluate((el) => el.getAnimations().length);
    expect(animations).toBe(0);
    await expect(detail(page)).toBeVisible();
    await page.locator("[data-detail-back]").click();
    await expect(detail(page)).toBeHidden();
  });
});

test("Apply opens the real role without agent tracking", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  const apply = detail(page).getByRole("link", { name: copy.connect.apply, exact: true });
  await expect(apply).toBeVisible();
  expect(await apply.getAttribute("href")).not.toContain("utm_medium=agent");
  await expect(apply).toHaveAttribute("rel", "noopener noreferrer");
  await expect(apply).toHaveAttribute("target", "_blank");
});

test("Escape closes the connect sheet and keeps focus on its button", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  const follow = detail(page).getByRole("button", { name: copy.connect.follow });
  await follow.click();
  await expect(page.locator("[data-connect-sheet=follow]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-connect-sheet]")).toHaveCount(0);
  await expect(follow).toBeFocused();
  await expect(detail(page)).toBeVisible();
});
