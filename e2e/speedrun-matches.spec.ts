import { speedrunCopy } from "../lib/content";
import { reasonLine } from "../lib/speedrun/matchList";
import type { MatchResult } from "../lib/speedrun/match";
import { PEOPLE } from "../lib/speedrun/people";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, joinPhase, networkHeading, openTab, skipBuildLog, startOver, tabKey } from "./speedrun-flow";

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
    // Catches: a key that moves nothing (a Tab that WebKit ignores), which would leave the list rows unreachable for the wrong reason.
    if (i === 0) expect(await page.evaluate(() => document.activeElement?.matches("[data-detail-back]"))).toBe(false);
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

const INTRO = copy.intro;
const SAM_ANSWERS = { name: "Sam", targets: ["product", "engineering"] as ("product" | "engineering")[], places: ["New York", "Remote"], why: PEOPLE.sam.intake.why, person: "sam" as const };
const bringToggle = (page: Page) => detail(page).locator("[data-bring-forward]");
const requestButton = (page: Page) => detail(page).locator("[data-request-intro]");
const introOn = (page: Page) => detail(page).locator("[data-intro-on]");
const rankText = (page: Page) => detail(page).locator("[data-shortlist-rank]");
const swapButton = (page: Page) => detail(page).getByRole("button", { name: INTRO.swap });

/** The row indexes of the first two matches that take a warm intro. */
function eligibleRows(result: MatchResult): [number, number] {
  const at = result.matches.flatMap((match, i) => (match.connect.includes("intro") ? [i] : []));
  expect(at.length, "the fixture needs two matches that take an intro").toBeGreaterThanOrEqual(2);
  return [at[0], at[1]];
}

async function pick(page: Page, row: number) {
  await rows(page).nth(row).click();
  await expect(rows(page).nth(row)).toHaveAttribute("aria-current", "true");
}

async function bringForward(page: Page, row: number) {
  await pick(page, row);
  await bringToggle(page).click();
  await expect(bringToggle(page)).toHaveAttribute("aria-pressed", "true");
}

test("intro request: the detail pane has exactly one filled action, and it is the request when there is one to make", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const first = seen.result!.matches.findIndex((match) => match.connect.includes("intro") && match.connect.includes("apply") && match.role);
  expect(first, "the fixture needs a match with both an intro and an Apply").toBeGreaterThanOrEqual(0);
  const ink = await page.locator("[data-speedrun]").first().evaluate((root) => {
    const probe = document.createElement("div");
    probe.className = "bg-sr-ink";
    root.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  const filled = () =>
    detail(page).locator("button:visible, a:visible").evaluateAll((nodes, color) => nodes.filter((node) => getComputedStyle(node).backgroundColor === color).map((node) => node.textContent?.trim()), ink);
  // Nothing is brought forward, so the request cannot be made and Apply is the filled one.
  const withRole = seen.result!.matches.findIndex((match) => match.role && match.connect.includes("apply"));
  await pick(page, withRole);
  // Catches: the action reading last in the pane (design-review cold read), or two filled marks competing.
  await expect.poll(filled).toEqual([expect.stringContaining(copy.connect.apply)]);
  await bringForward(page, first);
  // Catches: a match without Apply, which would let "Apply keeping the fill" pass for nothing.
  await expect(detail(page).getByRole("link", { name: copy.connect.apply, exact: true })).toBeVisible();
  // Catches: the request staying disabled on a brought-forward, eligible #1.
  await expect(requestButton(page)).toBeEnabled();
  // Catches: Apply keeping the fill once the request is the pane's main action.
  await expect.poll(filled).toEqual([INTRO.request]);
});

test("intro request: the button waits for a shortlist and for #1, and says why", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const [a, b] = eligibleRows(seen.result!);
  await pick(page, a);
  // Catches: a request on a match nobody brought forward (Ruling P7).
  await expect(requestButton(page)).toBeDisabled();
  await expect(detail(page)).toContainText(INTRO.hintBring);
  await bringForward(page, a);
  await bringForward(page, b);
  // Catches: requests on any pick, not only #1 (Ruling 44).
  await expect(requestButton(page)).toBeDisabled();
  await expect(detail(page)).toContainText(INTRO.hintFirst(2));
  await pick(page, a);
  // Catches: the first pick staying locked after the second was added.
  await expect(requestButton(page)).toBeEnabled();
});

test("intro request: one request on #1 puts the line on every other match", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const [a, b] = eligibleRows(seen.result!);
  const nameA = seen.result!.matches[a].company.name;
  await bringForward(page, a);
  await bringForward(page, b);
  await pick(page, a);
  await requestButton(page).click();
  // Catches: the request button staying live on the match that holds it, so a second request can be made.
  await expect(requestButton(page)).toHaveCount(0);
  await expect(detail(page)).toContainText(INTRO.here);
  // Catches: focus dropped to the body when the pressed button is replaced by the line.
  await expect(detail(page).locator("[data-intro-here]")).toBeFocused();
  await pick(page, b);
  // Catches: more than one live request, or the line missing on the other match.
  await expect(introOn(page)).toHaveText(INTRO.on(nameA));
  await expect(requestButton(page)).toHaveCount(0);
  // Catches: a match outside the shortlist offering a swap, or no line, once the request is spent.
  const outside = seen.result!.matches.findIndex((_, i) => i !== a && i !== b);
  await pick(page, outside);
  await expect(introOn(page)).toHaveText(INTRO.on(nameA));
  await expect(swapButton(page)).toHaveCount(0);
});

test("intro request: Move my request here makes that match #1 and moves the line", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const [a, b] = eligibleRows(seen.result!);
  const [nameA, nameB] = [a, b].map((i) => seen.result!.matches[i].company.name);
  await bringForward(page, a);
  await bringForward(page, b);
  await pick(page, a);
  await requestButton(page).click();
  await pick(page, b);
  // Catches: the second pick not showing its place on the shortlist before the swap.
  await expect(rankText(page)).toHaveText("#2");
  await swapButton(page).click();
  // Catches: a swap that leaves the rank, so #2 holds the request.
  await expect(rankText(page)).toHaveText("#1");
  // Catches: a swap that leaves the line on the old match, or two live requests.
  await expect(introOn(page)).toHaveCount(0);
  await expect(detail(page)).toContainText(INTRO.here);
  // Catches: focus dropped to the body when the swap button is replaced by the line.
  await expect(detail(page).locator("[data-intro-here]")).toBeFocused();
  await pick(page, a);
  // Catches: the old #1 keeping its rank after the swap.
  await expect(rankText(page)).toHaveText("#2");
  await expect(introOn(page)).toHaveText(INTRO.on(nameB));
  await expect(swapButton(page)).toBeVisible();
  expect(nameA).not.toBe(nameB);
});

test("intro request: taking the requested match off the shortlist frees the request", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const [a, b] = eligibleRows(seen.result!);
  await bringForward(page, a);
  await bringForward(page, b);
  await pick(page, a);
  await requestButton(page).click();
  await bringToggle(page).click();
  await pick(page, b);
  // Catches: a request left standing on a match the visitor took off, locking the others out for good.
  await expect(introOn(page)).toHaveCount(0);
  await expect(requestButton(page)).toBeEnabled();
});

test("intro request: Start over clears the shortlist and the request", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const [a, b] = eligibleRows(seen.result!);
  await bringForward(page, a);
  await bringForward(page, b);
  await pick(page, a);
  await requestButton(page).click();
  await startOver(page);
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
  await answerOnboarding(page, SAM_ANSWERS);
  await toMatches(page);
  // Catches: a shortlist or request that survives Start over (Review Focus 3).
  await expect(page.locator("[data-intro-on], [data-intro-here]")).toHaveCount(0);
  await pick(page, a);
  await expect(bringToggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(requestButton(page)).toBeDisabled();
  await expect(page.locator('[data-row-bring-forward][aria-pressed="true"]')).toHaveCount(0);
});

test("bring forward: the row toggle and the detail toggle are one state, and a row toggle keeps the selection", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  await toMatches(page);
  const second = page.locator("[data-row-bring-forward]").nth(1);
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  // Catches: the toggle sitting inside the row's button, so one click also selects the match.
  await expect(rows(page).first()).toHaveAttribute("aria-current", "true");
  await pick(page, 1);
  // Catches: the row and the detail keeping separate shortlist state.
  await expect(bringToggle(page)).toHaveAttribute("aria-pressed", "true");
  // Catches: the rank missing beside the toggle, or the toggle's name changing with its state.
  await expect(rankText(page)).toHaveText("#1");
  await expect(bringToggle(page)).toHaveAccessibleName(INTRO.bring);
});

test("intro request: on a phone every new control is at least 44 by 44", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const seen = await watchMatches(page);
  await joinAs(page, "sam");
  await toMatches(page);
  const [a, b] = eligibleRows(seen.result!);
  const big = async (target: Locator) => {
    const box = await target.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  };
  // Catches: a small toggle in the list, which a thumb misses (Ruling 68).
  await big(page.locator("[data-row-bring-forward]").first());
  for (const row of [a, b]) {
    await rows(page).nth(row).click();
    await expect(detail(page)).toBeVisible();
    await big(bringToggle(page));
    await bringToggle(page).click();
    await big(requestButton(page));
    await page.locator("[data-detail-back]").click();
    await expect(detail(page)).toBeHidden();
  }
  await rows(page).nth(a).click();
  await requestButton(page).click();
  await page.locator("[data-detail-back]").click();
  await rows(page).nth(b).click();
  await expect(detail(page)).toBeVisible();
  await big(swapButton(page));
});

test("intro request: with no request and no Apply the toggle is the filled action, and an ineligible match shows only the no-path line", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  // Row 0 is company-only (an intro and Follow, no role); the last row has no intro path.
  const seen = await watchMatches(page, (result) => {
    const matches = result.matches.map((match) => ({ ...match }));
    matches[0] = { ...matches[0], role: null, connect: ["intro", "follow"] };
    const last = matches.length - 1;
    matches[last] = { ...matches[last], connect: matches[last].connect.filter((way) => way !== "intro") };
    return { ...result, matches };
  });
  await joinAs(page, "sam");
  await toMatches(page);
  const last = seen.result!.matches.length - 1;
  const ink = await page.locator("[data-speedrun]").first().evaluate((root) => {
    const probe = document.createElement("div");
    probe.className = "bg-sr-ink";
    root.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  const filled = () =>
    detail(page).locator("button:visible, a:visible").evaluateAll((nodes, color) => nodes.filter((node) => getComputedStyle(node).backgroundColor === color).map((node) => node.textContent?.trim()), ink);
  await bringForward(page, 1);
  await pick(page, 0);
  // Catches: a company-only match with no filled action at all (the pane reads flat).
  await expect.poll(filled).toEqual([INTRO.bring]);
  await bringToggle(page).click();
  // Catches: the company-only match not sitting at #2, so the no-fill check would run with Request live.
  await expect(rankText(page)).toHaveText("#2");
  // Catches: a pressed toggle keeping the fill when neither Request (it is #2) nor Apply is available.
  await expect.poll(filled).toEqual([]);
  await pick(page, last);
  // Catches: an ineligible match told to bring it forward first, or offered a request button.
  await expect(detail(page)).toContainText(INTRO.hintNoPath);
  await expect(detail(page)).not.toContainText(INTRO.hintBring);
  // Catches: a request button rendered, even disabled, on a match with no intro path.
  await expect(requestButton(page)).toHaveCount(0);
  await bringToggle(page).click();
  // Catches: the shortlist position taking over the hint once the ineligible match is brought forward.
  await expect(detail(page)).toContainText(INTRO.hintNoPath);
  // Catches: the request button appearing on a brought-forward match that has no intro path.
  await expect(requestButton(page)).toHaveCount(0);
});

test("intro request: the Board's Intros tile counts the request, and its list agrees, before and after", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const seen = await watchMatches(page);
  await page.goto("/speedrun");
  await answerOnboarding(page, { ...SAM_ANSWERS, connectGmail: true });
  await toMatches(page);
  const tile = page.locator("[data-stat=intros]");
  const items = page.locator('[data-tile-panel="intros"] [data-tile-item]');
  await openTab(page, TAB.board);
  await tile.click();
  const before = await items.count();
  // Catches: a tile number from the raw intro emails while its list is built from the cards, so the two disagree.
  expect(Number(await tile.getAttribute("data-value"))).toBe(before);
  const [a] = eligibleRows(seen.result!);
  await openTab(page, TAB.matches);
  await bringForward(page, a);
  await requestButton(page).click();
  await openTab(page, TAB.board);
  // Catches: a live intro request that the tile and the list both ignore, or only one of them counts.
  await expect(items).toHaveCount(before + 1);
  expect(Number(await tile.getAttribute("data-value"))).toBe(before + 1);
});

test("intro request: when #1 has no intro path, every other pick says so and the Board link switches tabs", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await watchMatches(page, (result) => {
    const matches = result.matches.map((match) => ({ ...match }));
    matches[0] = { ...matches[0], connect: matches[0].connect.filter((way) => way !== "intro") };
    matches[1] = { ...matches[1], connect: [...new Set([...matches[1].connect, "intro" as const])] };
    return { ...result, matches };
  });
  await joinAs(page, "sam");
  await toMatches(page);
  await bringForward(page, 0);
  await bringForward(page, 1);
  const note = detail(page).locator("#sr-intro-note");
  // Catches: the "it goes to your #1" hint on a pick whose #1 can never take the request, a dead end with no way forward.
  await expect(note).toContainText(INTRO.hintNoPathFirst.before.trim());
  const link = note.locator("[data-intro-board]");
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(43.95);
  await link.click();
  // Catches: the link doing nothing instead of opening the Board tab.
  await expect(page.locator("[data-board]")).toBeVisible();
});
