import { speedrunCopy } from "../lib/content";
import { reasonLine } from "../lib/speedrun/matchList";
import type { MatchResult } from "../lib/speedrun/match";
import { PEOPLE } from "../lib/speedrun/people";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, networkHeading, openTab, skipBuildLog, tabKey } from "./speedrun-flow";

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

const settleFrames = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
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
  // Catches: rows that read as static text, with no sign they open (spec section 5).
  await expect(rows(page).first().locator('svg.lucide-chevron-right[aria-hidden="true"]')).toHaveCount(1);
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
  // Catches: focus staying outside the sheet after a click (Safari does not focus a button on click), so the Escape never arrives.
  await expect(page.locator("[data-connect-sheet=follow]")).toBeFocused();
  // Catches: a missing preventDefault in the sheet's handler, or a detail that ignores defaultPrevented.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-connect-sheet]")).toHaveCount(0);
  // toBeVisible alone also passes during the close slide, so wait it out (stepMs is 360) and check nothing is sliding.
  await page.waitForTimeout(700);
  await expect(detail(page)).toBeVisible();
  expect(await detail(page).evaluate((el) => el.getAnimations().length)).toBe(0);
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
  await settleFrames(page);
  // Catches: the two-pane view resetting to the first match when the layout widens.
  await expect(third).toHaveAttribute("aria-current", "true");
  await expect(detail(page)).toBeVisible();
  await expect(detail(page).locator("[data-detail-heading]")).toHaveText(name);
});

// Catches: arrow keys dying after a mouse click in Safari, which does not focus a button it was clicked on (simulated by cancelling mousedown).
test("a click on a row focuses it even when the engine would not, so Down keeps working", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  await page.evaluate(() => document.addEventListener("mousedown", (event) => event.preventDefault(), true));
  await rows(page).nth(1).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await rows(page).nth(2).click();
  await expect(rows(page).nth(2)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(rows(page).nth(3)).toBeFocused();
  await expect(rows(page).nth(3)).toHaveAttribute("aria-current", "true");
});

test("Down from the focused list heading lands on the first row, not the second", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  await networkHeading(page).focus();
  // Catches: the heading's first Down skipping row 1 because row 1 is already selected.
  await page.keyboard.press("ArrowDown");
  await expect(rows(page).first()).toBeFocused();
  await expect(rows(page).first()).toHaveAttribute("aria-current", "true");
});

test("phone: Back then widening leaves no held slide on the detail", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  await rows(page).first().click();
  await expect(detail(page)).toBeVisible();
  await page.locator("[data-detail-back]").click();
  await expect(detail(page)).toBeHidden();
  await page.setViewportSize(DESKTOP);
  await settleFrames(page);
  // Catches: the close slide's forwards fill surviving display:none and parking the column at translateX(100%).
  expect(await detail(page).evaluate((el) => el.getAnimations().length)).toBe(0);
  const fits = await detail(page).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const section = el.closest("[data-matches]")!.getBoundingClientRect();
    const panel = el.closest<HTMLElement>("[role=tabpanel]")!;
    return { inside: box.left >= section.left - 1 && box.right <= section.right + 1, noSideways: panel.scrollWidth <= panel.clientWidth };
  });
  expect(fits).toEqual({ inside: true, noSideways: true });
});

test("phone: the list is inert behind an open detail, and not inert once widened", async ({ page, browserName }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  await rows(page).first().click();
  await expect(detail(page)).toBeVisible();
  const list = page.locator("[data-match-list]");
  // Catches: hidden rows staying in the tab order and the accessibility tree behind the detail.
  await expect(list).toHaveAttribute("inert", "");
  await page.locator("[data-detail-back]").focus();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(`Shift+${tabKey(browserName)}`);
    expect(await page.evaluate(() => document.activeElement?.closest("[data-match-row]") !== null)).toBe(false);
  }
  await page.setViewportSize(DESKTOP);
  await settleFrames(page);
  await expect(list).not.toHaveAttribute("inert", "");
  // Narrow again with the detail still open: it covers the list, so the list is inert again.
  await page.setViewportSize(PHONE);
  await settleFrames(page);
  await expect(list).toHaveAttribute("inert", "");
  await page.locator("[data-detail-back]").click();
  await expect(detail(page)).toBeHidden();
  await expect(list).not.toHaveAttribute("inert", "");
});

test("phone: Up and Down on Next: Board leave focus on the button", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  const next = page.locator("[data-match-list]").getByRole("button", { name: speedrunCopy.network.nextTo.matches });
  await next.focus();
  // Catches: the list-level Up and Down handler hijacking the button and jumping focus to the selected row.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(next).toBeFocused();
});

test("phone: a detail reopened after scrolling starts at its top", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await joinAs(page, "sam");
  await toMatches(page);
  await rows(page).first().click();
  await expect(detail(page)).toBeVisible();
  const room = await detail(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return { over: el.scrollHeight - el.clientHeight, at: el.scrollTop };
  });
  // Precondition: the card must overflow, or a zero offset proves nothing.
  expect(room.over).toBeGreaterThan(0);
  expect(room.at).toBeGreaterThan(0);
  // Close without scrolling Back into view (a Playwright click on Back would zero the offset itself).
  await detail(page).evaluate((el) => el.querySelector<HTMLElement>("[data-detail-back]")!.click());
  await expect(detail(page)).toBeHidden();
  await rows(page).first().click();
  await expect(detail(page)).toBeVisible();
  // Catches: a detail reopening mid-scroll, because a hidden scroller gets its offset back when shown.
  expect(await detail(page).evaluate((el) => el.scrollTop)).toBe(0);
});

test("short landscape: opening a detail never scrolls the page sideways and Back clears the logo", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await joinAs(page, "sam");
  await toMatches(page);
  const lower = rows(page).nth(2);
  await expect(lower).toBeVisible();
  // Precondition: the page scrolls here, and it is scrolled so the tap lands on a partly scrolled list.
  const scrolled = await page.evaluate(() => {
    window.scrollTo({ top: 300, behavior: "instant" });
    return { room: document.documentElement.scrollHeight - window.innerHeight, at: window.scrollY };
  });
  expect(scrolled.room).toBeGreaterThan(0);
  expect(scrolled.at).toBeGreaterThan(0);
  // The section's top is above the viewport now, which is what makes the fallback scroll the page.
  expect(await page.locator("[data-matches]").evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(0);
  // Armed before the click: records the largest scrollX on every scroll event and every frame.
  await page.evaluate(() => {
    const w = window as unknown as { __maxScrollX: number };
    w.__maxScrollX = 0;
    const sample = () => {
      w.__maxScrollX = Math.max(w.__maxScrollX, window.scrollX);
    };
    window.addEventListener("scroll", sample, { passive: true });
    const tick = () => {
      sample();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await lower.evaluate((el) => (el as HTMLElement).click());
  await expect(detail(page)).toBeVisible();
  await page.waitForTimeout(500);
  // Catches: the page travelling sideways at all during the slide; max-lg:overflow-x-clip on the section makes that impossible. Headless never
  // reproduced the whip itself with round 2's scrollIntoView and no clip (this sampler stayed green there, the logo pin below went red), so this is a guard, not a repro.
  expect(await page.evaluate(() => (window as unknown as { __maxScrollX: number }).__maxScrollX)).toBe(0);
  const geometry = await page.evaluate(() => {
    const back = document.querySelector<HTMLElement>("[data-detail-back]")!.getBoundingClientRect();
    const logo = document.querySelector<HTMLElement>(".site-logo")!.getBoundingClientRect();
    return { backTop: back.top, logoBottom: logo.bottom, height: window.innerHeight };
  });
  // Catches: Back under the fixed site logo, or off screen.
  expect(geometry.backTop).toBeGreaterThanOrEqual(geometry.logoBottom);
  expect(geometry.backTop).toBeLessThan(geometry.height);
});

test("phone: Next: Board ends the list, inside its scroller, and opens the Board tab", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  const list = page.locator("[data-match-list]");
  const next = list.getByRole("button", { name: speedrunCopy.network.nextTo.matches });
  await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(next).toBeVisible();
  // Catches: the button sitting below the two panes, outside the list a phone user is scrolling.
  const inside = await next.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const frame = el.closest("[data-match-list]")!.getBoundingClientRect();
    return box.top >= frame.top && box.bottom <= frame.bottom + 1;
  });
  expect(inside).toBe(true);
  await next.click();
  await expect(page.getByRole("tab", { name: TAB.board, exact: true })).toHaveAttribute("aria-selected", "true");
});

test("Dev sees the founder route row first, and its detail has both links", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "dev");
  await toMatches(page);
  const first = rows(page).first();
  // Catches: the founder row sorting below the company rows, or its detail losing a link.
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
    // Catches: focus leaving the heading on an empty list. A throwing moveSelection is guarded by vitest, not here.
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
    // Catches: Down off the only row wrapping or dropping focus.
    await expect(rows(page).first()).toBeFocused();
    await expect(rows(page).first()).toHaveAttribute("aria-current", "true");
  });
});

test("Skip jumps straight to the matches", async ({ page }) => {
  await joinAs(page, "sam");
  await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
  // Catches: Skip leaving the build log on screen.
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
  // Catches: the sheet opening without taking focus (Safari leaves focus on the page behind), so Escape goes nowhere.
  await expect(page.locator("[data-connect-sheet=follow]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-connect-sheet]")).toHaveCount(0);
  await expect(follow).toBeFocused();
  await expect(detail(page)).toBeVisible();
});

test("phone: a click on plain card text keeps focus in the detail, so Escape still closes it", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  await toMatches(page);
  await rows(page).first().click();
  await expect(detail(page)).toBeVisible();
  await detail(page).locator("p").first().click();
  // Catches: focus falling to the body on a click in non-focusable text (the list is inert), so the detail's Escape never fires.
  expect(await detail(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(detail(page)).toBeHidden();
});

test("short landscape: the tab bar stays inside the viewport when the page is scrolled to the middle", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await joinAs(page, "sam");
  await toMatches(page);
  const geometry = await page.evaluate(async () => {
    const room = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.floor(room / 2), behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const bar = document.querySelector<HTMLElement>("[role=tablist]")!.getBoundingClientRect();
    return { room, at: window.scrollY, bottom: bar.bottom, height: window.innerHeight };
  });
  // Precondition: the page scrolls and is away from both ends, or sticky proves nothing.
  expect(geometry.room).toBeGreaterThan(0);
  expect(geometry.at).toBeGreaterThan(0);
  expect(geometry.at).toBeLessThan(geometry.room);
  // Catches: the tab bar scrolling off screen on a short landscape phone, where the page (not a panel) scrolls.
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1);
  expect(geometry.bottom).toBeGreaterThan(0);
});
