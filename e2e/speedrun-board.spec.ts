import { siteContent, speedrunCopy } from "../lib/content";
import { rankMatches } from "../lib/speedrun/match";
import { PEOPLE } from "../lib/speedrun/people";
import { getSnapshot } from "../lib/speedrun/snapshot";
import { shortDay } from "../lib/speedrun/when";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, probeFlowLabels, networkHeading, openTab, playSwitch, skipBuildLog } from "./speedrun-flow";

const COPY = speedrunCopy.board;

// The board lives on its own tab; skipBuildLog also clicks Continue when reduced motion shows the finished log.
async function joinAs(page: Page, key: "sam" | "dev", connected: boolean) {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Sam", person: key, connectGmail: connected });
  await skipBuildLog(page);
  await openTab(page, speedrunCopy.network.tabs.board);
  await expect(page.locator("[data-board]")).toBeVisible({ timeout: 20_000 });
}

test("Skip to the dashboard lands on the network, and its board is connected", async ({ page }) => {
  await page.goto("/speedrun");
  await playSwitch(page);
  await page.getByRole("button", { name: speedrunCopy.hero.ctaSecondary }).first().click();
  await skipBuildLog(page);
  await expect(networkHeading(page)).toBeFocused();
  await expect(page.locator("#sr-matches-heading")).toBeVisible();
  await openTab(page, speedrunCopy.network.tabs.board);
  await expect(page.locator("[data-board]")).toBeVisible();
  await expect(page.locator("[data-connect-prompt]")).toHaveCount(0);
  await expect(page.locator("[data-today-list]")).toBeVisible();
  await openTab(page, speedrunCopy.network.tabs.brief);
  await expect(page.locator("[data-brief]")).toBeVisible();
});

const stat = (page: Page, key: string) => page.locator(`[data-stat=${key}]`);
const statValue = async (page: Page, key: string) => Number(await stat(page, key).getAttribute("data-value"));

// Catches: the visible stat number drifting from the number the tile announces (the count-up must land on it).
test("the visible stat number is the number the tile announces, with motion", async ({ page }) => {
  await joinAs(page, "sam", true);
  const visible = stat(page, "inProcess").locator('[aria-hidden="true"]');
  await expect(visible).toHaveText(String(await statValue(page, "inProcess")));
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  // Catches: a count-up that still shows its starting number for a visitor who asked for no motion.
  test("the visible stat number is final on arrival", async ({ page }) => {
    await joinAs(page, "sam", true);
    const visible = stat(page, "inProcess").locator('[aria-hidden="true"]');
    await expect(visible).toHaveText(String(await statValue(page, "inProcess")));
  });
});

test("without Gmail the board asks to connect, and one click builds it", async ({ page }) => {
  await joinAs(page, "sam", false);
  const prompt = page.locator("[data-connect-prompt]");
  await expect(prompt).toContainText(COPY.connectPrompt);
  await expect(page.locator("[data-board-stats]")).toHaveCount(0);
  await prompt.getByRole("button", { name: COPY.connectButton }).click();
  await expect(page.locator("#sr-board-heading")).toBeFocused();
  await expect(stat(page, "applied")).toBeVisible();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator("[data-board-table] [data-row]").first()).toBeVisible();
});

test("the table caps at eight rows until show all", async ({ page }) => {
  await joinAs(page, "dev", true);
  const rows = page.locator("[data-board-table] [data-row]");
  await expect(rows).toHaveCount(8);
  await page.getByRole("button", { name: /^show all \d+$/ }).click();
  expect(await rows.count()).toBeGreaterThan(8);
});

test("the tools card links the six real pages and says each opens a new tab", async ({ page }) => {
  await joinAs(page, "dev", true);
  const links = page.locator("[data-tools-list] a");
  const rows = COPY.tools.rows;
  await expect(links).toHaveCount(rows.length);
  for (const [index, row] of rows.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAttribute("href", row.href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(row.href).not.toContain("-ad00000");
    await expect(link).toHaveAccessibleDescription(speedrunCopy.newTab);
  }
});

// Catches: labels sitting on node bars, on each other, or under a link (Ruling 19), in the Board's full chart (wide from lg, tall below).
// Dev is the only persona with lanes (six columns); sam has none.
for (const person of ["sam", "dev"] as const) for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`the board chart's labels clear the nodes and each other for ${person} at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await joinAs(page, person, true);
    const probe = await probeFlowLabels(page, "[data-board]");
    expect(probe.labels).toBeGreaterThan(8);
    expect(probe.onNodes).toEqual([]);
    expect(probe.overlapping).toEqual([]);
    expect(probe.unbacked).toEqual([]);
    expect(probe.clipped).toEqual([]);
  });
}

// ---- Task 6a: the board's top (Rulings 46 to 50) ----

const ACTIONS = speedrunCopy.actions;
const sheet = (page: Page) => page.locator("dialog[data-action-sheet]");
const needs = (page: Page) => page.locator("[data-needs-item]");
const countLine = (page: Page) => page.locator("[data-needs-count]");
const boardHeading = (page: Page) => page.locator("#sr-board-heading");
const rows = (page: Page) => page.locator("[data-board-table] [data-row]");
const rowNames = (page: Page) => rows(page).locator('[data-cell="company"]').allInnerTexts().then((names) => names.map((name) => name.split("\n")[0].trim()));
const th = (page: Page, key: string) => page.locator(`[data-board-table] th[data-col="${key}"]`);
// Sam's four, in the order the due dates and ranks give: Wrenfield (Nov 9), Lumora Health (Nov 10), Cindermoor Cloud (Nov 11), Quillbright (Nov 12).
const NEEDS = ["Wrenfield", "Lumora Health", "Cindermoor Cloud", "Quillbright"];
const DATE = /^[A-Z][a-z]{2} \d{1,2}$/;

test("board top: at 1440 the four things that need Sam sit above the fold, each with a company, a person, a deadline and a button", async ({ page }) => {
  await joinAs(page, "sam", true);
  // Catches: a heading that never says whose board this is (Ruling 46).
  await expect(boardHeading(page)).toHaveText(COPY.heading("Sam"));
  // Catches: no count of how much needs the visitor.
  await expect(countLine(page)).toHaveText(COPY.count(4));
  await expect(needs(page)).toHaveCount(4);
  // Catches: the list ranked by anything but due date, or built from the wrong rows.
  await expect(needs(page).locator("[data-needs-company]")).toHaveText(NEEDS);
  // Catches: a button that names a different action from the item it sits on.
  await expect(needs(page).locator("[data-needs-action]")).toHaveText([ACTIONS.briefButtons.decideOffer, ACTIONS.briefButtons.pickTime, ACTIONS.briefButtons.confirmInterview, ACTIONS.briefButtons.decideOffer]);
  // Catches: a deadline that is not the pinned date.
  await expect(needs(page).first().locator("[data-needs-due]")).toHaveText(COPY.needs.due(shortDay("2026-11-09")));
  for (let i = 0; i < 4; i++) {
    const item = needs(page).nth(i);
    // Catches: an item that does not say who it is with (the first glance offers nothing).
    await expect(item.locator("[data-needs-who]")).toContainText("Aaron Sulbaran");
    await expect(item.locator("[data-needs-what]")).not.toHaveText("");
    const box = (await item.boundingBox())!;
    // Catches: the fourth item (or any button) pushed below the 900 px fold by what sits above it.
    expect(box.y + box.height, `item ${i + 1} bottom`).toBeLessThanOrEqual(900);
  }
});

test("board top: the chart sits right under the tiles and above the table, and is no longer a card", async ({ page }) => {
  await joinAs(page, "sam", true);
  const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;
  const needsBox = await box("[data-needs-you]");
  const tiles = await box("[data-board-stats]");
  const flow = await box("[data-board-flow]");
  const table = await box("[data-board-table]");
  // Catches: the tiles above the needs-you list, which is the one thing the visitor came for.
  expect(needsBox.y + needsBox.height).toBeLessThanOrEqual(tiles.y);
  // Catches: the chart buried below the table or the cards.
  expect(flow.y).toBeGreaterThanOrEqual(tiles.y + tiles.height);
  expect(flow.y - (tiles.y + tiles.height)).toBeLessThan(64);
  expect(table.y).toBeGreaterThanOrEqual(flow.y + flow.height);
  // Catches: the chart still wrapped in the old arrangeable card.
  await expect(page.locator("[data-board-flow]").locator("xpath=ancestor-or-self::*[@data-board-card]")).toHaveCount(0);
});

test("needs you: confirming one dims it in place, lowers the count and leaves the others alone", async ({ page }) => {
  await joinAs(page, "sam", true);
  const first = needs(page).first();
  await first.locator("[data-needs-action]").click();
  // Catches: a button that opens nothing, so the decision cannot be made.
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator("[data-sheet-confirm]").click();
  // Catches: a confirm or Not now that leaves the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  // Catches: a done item removed from the list, so the others jump up under the visitor (Ruling P8).
  await expect(needs(page)).toHaveCount(4);
  await expect(needs(page).first().locator("[data-needs-company]")).toHaveText("Wrenfield");
  await expect(first).toHaveAttribute("data-done", "true");
  // Catches: a done item that does not look quiet.
  await expect(first).toHaveCSS("opacity", "0.7");
  // Catches: the heading counting items that are already done.
  await expect(countLine(page)).toHaveText(COPY.count(3));
  // Catches: a done item keeping a live button, which could decide the same offer twice.
  await expect(first.locator("[data-needs-action]")).toHaveCount(0);
  await expect(first.locator("[data-action-done]")).toHaveText(ACTIONS.sheets.decideOffer.done);
  // Catches: focus dropping to the page when the button is swapped for the quiet check, which should take it.
  await expect(first.locator("[data-action-done]")).toBeFocused();
  // Catches: the other items marked done along with it.
  await expect(needs(page).nth(1)).toHaveAttribute("data-done", "false");
});

test("needs you: confirming Pick a time in the brief drops the Board's count by one", async ({ page }) => {
  await joinAs(page, "sam", true);
  const before = await countLine(page).innerText();
  // Catches: a starting count that is not the four items the Board shows.
  expect(before).toBe(COPY.count(4));
  await openTab(page, speedrunCopy.network.tabs.brief);
  await page.locator('[data-brief-action="pickTime"]').click();
  // Catches: a button that opens nothing, so the decision cannot be made.
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator("[data-sheet-slot]").nth(1).click();
  // Catches: a confirm or Not now that leaves the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  await openTab(page, speedrunCopy.network.tabs.board);
  // Catches: a Board that keeps its own idea of what is done, so a decision made in the brief leaves the count at 4 (Ruling P4).
  await expect(countLine(page)).toHaveText(COPY.count(3));
  await expect(needs(page).nth(1)).toHaveAttribute("data-done", "true");
});

test("board top: pressing the Offers tile lists both offers with deadlines, filters the table to them, and pressing it again clears", async ({ page }) => {
  await joinAs(page, "sam", true);
  const tile = stat(page, "offers");
  await expect(tile).toHaveAttribute("aria-pressed", "false");
  await expect(tile).toHaveAttribute("aria-expanded", "false");
  await tile.click();
  // Catches: a tile that looks like a button and leads nowhere.
  await expect(tile).toHaveAttribute("aria-pressed", "true");
  await expect(tile).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator('[data-tile-panel="offers"]');
  await expect(panel.locator("[data-tile-item]")).toHaveCount(2);
  await expect(panel.locator("[data-tile-company]")).toHaveText(["Wrenfield", "Quillbright"]);
  // Catches: an offer listed without its deadline.
  await expect(panel.locator("[data-tile-due]")).toHaveText([COPY.needs.due(shortDay("2026-11-09")), COPY.needs.due(shortDay("2026-11-12"))]);
  // Catches: the drop-down opening and the table staying unfiltered.
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).locator('[data-cell="stage"]')).toHaveText([speedrunCopy.flow.stages.offer, speedrunCopy.flow.stages.offer]);
  // Catches: Decide on the offer opening a different sheet from the needs-you item's.
  await panel.locator("[data-tile-action]").first().click();
  // Catches: a button that opens nothing, so the decision cannot be made.
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("#sr-sheet-title")).toContainText("Wrenfield");
  await sheet(page).locator("[data-sheet-close]").click();
  // Catches: a confirm or Not now that leaves the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  await tile.click();
  // Catches: a pressed tile that cannot be un-pressed.
  await expect(tile).toHaveAttribute("aria-pressed", "false");
  await expect(panel).toHaveCount(0);
  await expect(rows(page)).toHaveCount(8);
});

test("board top: the Intros tile lists the warm intros, counts exactly them, and leaves the table alone", async ({ page }) => {
  await joinAs(page, "sam", true);
  const tile = stat(page, "intros");
  const before = await rows(page).count();
  await tile.click();
  const panel = page.locator('[data-tile-panel="intros"]');
  const items = panel.locator("[data-tile-item]");
  // Catches: an Intros drop-down that lists companies with no person or status.
  await expect(items.filter({ hasText: "Lumora Health" })).toContainText("Aaron Sulbaran");
  await expect(items.filter({ hasText: "Lumora Health" })).toContainText(COPY.introStatus.replied);
  await expect(items.filter({ hasText: "min/Max" })).toContainText(COPY.introStatus.scheduled);
  // Catches: the Intros tile emptying or reshaping the table (it counts intros, which the table's rows are not).
  await expect(rows(page)).toHaveCount(before);
  await expect(page.locator("[data-board-table] [data-filter]")).toHaveCount(4);
  await expect(page.locator('[data-board-table] [data-filter="all"]')).toHaveAttribute("aria-pressed", "true");
  // Catches: a tile number that is not the length of its own list.
  expect(await statValue(page, "intros")).toBe(await items.count());
});

test("board table: stage chips and tiles stay in step", async ({ page }) => {
  await joinAs(page, "sam", true);
  const chip = (key: string) => page.locator(`[data-board-table] [data-filter="${key}"]`);
  // Catches: a table that opens with a filter already on, or with no chip marked as the one in force.
  await expect(chip("all")).toHaveAttribute("aria-pressed", "true");
  await chip("closed").click();
  const closed = [speedrunCopy.flow.exits.rejected, speedrunCopy.flow.exits.noreply];
  const labels = await rows(page).locator('[data-cell="stage"]').allTextContents();
  // Catches: a Closed chip that lists nothing, which would pass the loop below without checking a row.
  expect(labels.length).toBeGreaterThan(0);
  // Catches: the Closed chip showing rows that are still open.
  for (const label of labels) expect(closed).toContain(label.trim());
  await expect(chip("closed")).toHaveAttribute("aria-pressed", "true");
  await chip("inProcess").click();
  // Catches: a chip that filters while the matching tile still says nothing is pressed.
  await expect(stat(page, "inProcess")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-tile-panel="inProcess"]')).toBeVisible();
  await chip("all").click();
  // Catches: All leaving a tile pressed, so the filter and the tiles disagree.
  await expect(stat(page, "inProcess")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-tile-panel]")).toHaveCount(0);
});

test("board table: a header click sorts, and aria-sort flips", async ({ page }) => {
  await joinAs(page, "sam", true);
  const sortedBy = (names: string[], dir: 1 | -1) => [...names].sort((a, b) => dir * a.toLowerCase().localeCompare(b.toLowerCase()));
  // Catches: a default order that is not soonest deadline first (Ruling 50).
  await expect(th(page, "next")).toHaveAttribute("aria-sort", "ascending");
  expect((await rowNames(page)).slice(0, 3)).toEqual(["Wrenfield", "Cindermoor Cloud", "Quillbright"]);
  await th(page, "company").getByRole("button").click();
  // Catches: a static table, one whose headers are decoration.
  await expect(th(page, "company")).toHaveAttribute("aria-sort", "ascending");
  await expect(th(page, "next")).toHaveAttribute("aria-sort", "none");
  const ascending = await rowNames(page);
  expect(ascending).toEqual(sortedBy(ascending, 1));
  await th(page, "company").getByRole("button").click();
  // Catches: a second click that does not reverse the order, or an aria-sort that does not follow it.
  await expect(th(page, "company")).toHaveAttribute("aria-sort", "descending");
  const descending = await rowNames(page);
  expect(descending).toEqual(sortedBy(descending, -1));
  expect(descending[0]).not.toBe(ascending[0]);
  for (const key of ["role", "stage", "applied", "lastUpdate", "next"]) {
    await th(page, key).getByRole("button").click();
    // Catches: a header that does not take over aria-sort (two columns both claiming the sort).
    await expect(th(page, key)).toHaveAttribute("aria-sort", "ascending");
    await expect(page.locator('[data-board-table] th[aria-sort="ascending"], [data-board-table] th[aria-sort="descending"]')).toHaveCount(1);
  }
});

test("board table: the cells carry dates, and the Next step cell opens the very sheet the needs-you item opens", async ({ page }) => {
  await joinAs(page, "sam", true);
  const wren = rows(page).filter({ hasText: "Wrenfield" }).first();
  // Catches: an Applied or Last update column of raw ISO text, or empty cells.
  await expect(wren.locator('[data-cell="applied"]')).toHaveText(DATE);
  await expect(wren.locator('[data-cell="lastUpdate"]')).toHaveText(DATE);
  // Catches: a Next step with no due date where one exists.
  await expect(wren.locator('[data-cell="next"]')).toContainText(shortDay("2026-11-09"));
  await needs(page).first().locator("[data-needs-action]").click();
  const fromNeeds = await sheet(page).locator("#sr-sheet-title").innerText();
  await sheet(page).locator("[data-sheet-close]").click();
  // Catches: a confirm or Not now that leaves the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  await wren.locator("[data-next-action]").click();
  // Catches: the table link opening a different sheet from the same action's other entrance.
  await expect(sheet(page).locator("#sr-sheet-title")).toHaveText(fromNeeds);
  await sheet(page).locator("[data-sheet-confirm]").click();
  // Catches: a confirm or Not now that leaves the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  // Catches: focus dropping to the page when the link is swapped for the quiet check.
  await expect(wren.locator("[data-action-done]")).toBeFocused();
  // Catches: a decision made in the table that the needs-you list never hears of (two clocks for one action).
  await expect(needs(page).first()).toHaveAttribute("data-done", "true");
});

test("board table: on a phone the table scrolls inside its own box, the page never scrolls sideways, and every new control is 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await joinAs(page, "sam", true);
  // Catches: the table pushing the page, or the tab's own scroll area (which would hide the overflow from the document), wider than the phone.
  expect(await page.evaluate(() => { const panel = document.querySelector('[role="tabpanel"]:not([hidden])'); return document.documentElement.scrollWidth <= document.documentElement.clientWidth && !!panel && panel.scrollWidth <= panel.clientWidth; })).toBe(true);
  const box = page.locator("[data-table-scroll]");
  // Catches: a table squeezed to fit, with no sideways scroll of its own.
  expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(box).toHaveCSS("overflow-x", "auto");
  // Collected and measured before any tile is pressed, so Show all and every Next-step link are still on the page.
  const controls = page.locator("[data-needs-action], [data-needs-toggle], [data-stat], [data-board-table] [data-filter], [data-board-table] th button, [data-next-action], [data-board-table] button[aria-expanded]");
  // Catches: the selector matching almost nothing, so the size loop below checks no controls at all.
  expect(await controls.count()).toBeGreaterThan(20);
  const sizes = await controls.evaluateAll((els) => els.map((el) => [el.textContent?.trim().slice(0, 20), el.getBoundingClientRect().width, el.getBoundingClientRect().height] as const));
  // 43.95 and not 44: a min-h-11 button lays out at 43.99997 px here, which is 44 px to a thumb.
  // Catches: any measured control (tile, chip, header, link, Show all, Details, action) under the 44 px touch size, in either direction.
  for (const [label, width, height] of sizes) {
    expect(width, `${label} width`).toBeGreaterThanOrEqual(43.95);
    expect(height, `${label} height`).toBeGreaterThanOrEqual(43.95);
  }
  // Catches: Show all missing from the measured set, so the table's own button could shrink unnoticed.
  expect(await page.locator("[data-board-table] button[aria-expanded]").count()).toBe(1);
  // Catches: Next-step links dropped from the measured set (only a few of the eight rows carry one, and each must be a thumb target).
  expect(await page.locator("[data-next-action]").count()).toBeGreaterThanOrEqual(3);
  await stat(page, "offers").click();
  const tileActions = await page.locator("[data-tile-action]").evaluateAll((els) => els.map((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]));
  // Catches: the Offers list showing no actions, so the size loop below would measure nothing.
  expect(tileActions).toHaveLength(2);
  // Catches: a tile's Decide on the offer button under the 44 px touch size.
  for (const [width, height] of tileActions) {
    expect(width).toBeGreaterThanOrEqual(43.95);
    expect(height).toBeGreaterThanOrEqual(43.95);
  }
  // Catches: a tile drop-down narrower than the phone, instead of stacking full width.
  const panel = (await page.locator('[data-tile-panel="offers"]').boundingBox())!;
  expect(panel.width).toBeGreaterThanOrEqual(390 - 32 - 2);
});

test.describe("board top under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("board top: a tile's drop-down opens with no animation", async ({ page }) => {
    await joinAs(page, "sam", true);
    await stat(page, "offers").click();
    const panel = page.locator('[data-tile-panel="offers"]');
    await expect(panel).toBeVisible();
    // Catches: a drop-down that animates for a visitor who asked for no motion.
    expect(await panel.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});

// A visitor whose own answers built the board has no sample person and no inbox. Only a server with reading switched on (and
// a stubbed read route) can get there, so this runs with the upload spec's environment.
test("board top: a visitor with no inbox and no sample person sees Your board and one pointer line, with no tiles", async ({ page }) => {
  test.skip(process.env.E2E_SPEEDRUN_AI !== "1", "needs E2E_SPEEDRUN_AI=1 and a server built with SPEEDRUN_AI=on and a dummy store pair, like the upload spec");
  await page.route("**/speedrun/api/read", async (route) => {
    const { profile, intake } = PEOPLE.sam;
    await route.fulfill({ json: { profile, result: rankMatches(profile, intake, getSnapshot()), mode: "model" } });
  });
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Zephyrine", stopAtResume: true });
  await page.locator("#join input[type=file]").setInputFiles({ name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("Ada Example, software engineer. SKILLS TypeScript, React, Postgres. Built a fictional billing tool.") });
  await skipBuildLog(page);
  await openTab(page, speedrunCopy.network.tabs.board);
  await expect(page.locator("[data-board]")).toBeVisible({ timeout: 20_000 });
  // Catches: the board naming a sample person who is not the visitor.
  await expect(boardHeading(page)).toHaveText(COPY.heading(null));
  const line = page.locator("[data-board-empty]");
  // Catches: a board with nothing to read and nothing to do (the first glance offers nothing).
  await expect(line).toContainText(COPY.empty.before.trim());
  await expect(line.getByRole("button", { name: COPY.empty.connect })).toBeVisible();
  await expect(line.getByRole("button", { name: COPY.empty.matches })).toBeVisible();
  // Catches: empty tiles, a needs-you list, a chart or a table drawn over nothing.
  for (const selector of ["[data-stat]", "[data-needs-item]", "[data-needs-you]", "[data-board-flow]", "[data-board-table]"]) await expect(page.locator(selector)).toHaveCount(0);
  // Catches: Tools lost with the rest of the top.
  await expect(page.locator("[data-tools-list]")).toBeVisible();
  // Catches: a Connect control that does nothing.
  await line.getByRole("button", { name: COPY.empty.connect }).click();
  await expect(page.locator("[data-board-empty]")).toContainText(COPY.empty.connectedBefore.trim());
  // Catches: a Matches control that leaves the visitor on the Board.
  await page.locator("[data-board-empty]").getByRole("button", { name: COPY.empty.matches }).click();
  await expect(page.getByRole("tab", { name: speedrunCopy.network.tabs.matches, exact: true })).toHaveAttribute("aria-selected", "true");
});

test("needs you: the contact and status columns start at the same x on every row, at 1024 and 1440", async ({ page }) => {
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await joinAs(page, "sam", true);
    const lefts = (selector: string) => page.locator(selector).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
    // Catches: free-width rows whose columns drift, so the eye cannot run down a column (L1).
    const who = await lefts("[data-needs-who]");
    expect(who).toHaveLength(4);
    for (const left of who) expect(Math.abs(left - who[0]), `contact column at ${width}`).toBeLessThanOrEqual(1);
    const due = await lefts("[data-needs-due]");
    for (const left of due) expect(Math.abs(left - due[0]), `due column at ${width}`).toBeLessThanOrEqual(1);
    await stat(page, "intros").click();
    const status = await lefts("[data-tile-status]");
    // Catches: an Intros list with no status cells, which would pass the drift loop below with nothing to compare.
    expect(status.length).toBeGreaterThanOrEqual(2);
    // Catches: the same drift in a tile's list, where the status column is the one to scan.
    for (const left of status) expect(Math.abs(left - status[0]), `status column at ${width}`).toBeLessThanOrEqual(1);
  }
});

test("board table: stage chips read as labels, not buttons, and every body row is the same height", async ({ page }) => {
  await joinAs(page, "sam", true);
  const chip = rows(page).first().locator('[data-cell="stage"] > span');
  const button = needs(page).first().locator("[data-needs-action]");
  const look = (locator: typeof chip) => locator.evaluate((el) => { const s = getComputedStyle(el); return { background: s.backgroundColor, radius: parseFloat(s.borderTopLeftRadius), height: el.getBoundingClientRect().height }; });
  const [c, b] = [await look(chip), await look(button)];
  // Catches: a chip filled with the same ink as the primary buttons, which reads as one (L2).
  expect(c.background).not.toBe(b.background);
  // Catches: a chip as tall as a button, or as round as one.
  expect(c.height).toBeLessThan(b.height);
  expect(c.radius).toBeLessThan(b.radius);
  await page.locator('[data-board-table] [data-filter="all"]').scrollIntoViewIfNeeded();
  const heights = await rows(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  // Catches: too few visible rows for the height comparison below to mean anything.
  expect(heights.length).toBeGreaterThan(5);
  // Catches: rows with a Next-step link taller than rows with plain text, so the table looks ragged (L3).
  for (const height of heights) expect(Math.abs(height - heights[0])).toBeLessThanOrEqual(1);
});

test("needs you: Details does not say the same thing three times", async ({ page }) => {
  await joinAs(page, "sam", true);
  const first = needs(page).first();
  await first.locator("[data-needs-toggle]").click();
  const details = first.locator("[data-needs-details]");
  // Catches: Details that never open, which would make the not-contain check below pass for nothing.
  await expect(details).toBeVisible();
  // Catches: the offer's role and stage restated under a title that already names the role (L4).
  await expect(details).not.toContainText(`Founding Engineer, ${speedrunCopy.flow.stages.offer}`);
  // Catches: Details that say nothing, or lose the line that remains.
  await expect(details).toContainText("Wrenfield");
});

test("needs you: a time picked in the Brief shows on the Board's done marker", async ({ page }) => {
  await joinAs(page, "sam", true);
  await openTab(page, speedrunCopy.network.tabs.brief);
  await page.locator('[data-brief-action="pickTime"]').click();
  // Catches: a button that opens nothing, so no time can be picked.
  await expect(sheet(page)).toBeVisible();
  const slot = sheet(page).locator("[data-sheet-slot]").nth(1);
  const time = (await slot.innerText()).trim();
  await slot.click();
  await openTab(page, speedrunCopy.network.tabs.board);
  // Catches: a Board that knows the item is done but not which time was sent, because the pick lived in the Brief's own state.
  await expect(needs(page).nth(1).locator("[data-action-done]")).toHaveText(`${ACTIONS.sheets.pickTime.done} ${time}`);
});

test("needs you: a Details line that the title does not repeat keeps its role and stage", async ({ page }) => {
  await joinAs(page, "dev", true);
  // Dev's Tessel Harbor item is a Prepare, whose title ("Get ready for Tessel Harbor") never names the role.
  const item = page.locator('[data-needs-item="prepare"]');
  await item.locator("[data-needs-toggle]").click();
  // Catches: the repeat-removal rule dropping the role and stage line for every item, leaving Details with no context at all.
  await expect(item.locator("[data-needs-details]")).toContainText(COPY.needs.row("Founding Engineer", speedrunCopy.flow.stages.interview));
});

test("board top: the Intros list and the table's filter leave each other alone", async ({ page }) => {
  await joinAs(page, "sam", true);
  const chip = (key: string) => page.locator(`[data-board-table] [data-filter="${key}"]`);
  await stat(page, "offers").click();
  // Catches: the Offers tile not filtering, which would make the "Intros leaves the filter alone" checks below pass for nothing.
  await expect(rows(page)).toHaveCount(2);
  await stat(page, "intros").click();
  // Catches: pressing Intros resetting the filter, which would put the table back on every row.
  await expect(chip("offers")).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(2);
  // Catches: an Intros press that does not open its own list while a filter is on.
  await expect(stat(page, "intros")).toHaveAttribute("aria-expanded", "true");
  await chip("closed").click();
  // Catches: a chip press closing the Intros list, which has nothing to do with the filter.
  await expect(page.locator('[data-tile-panel="intros"]')).toBeVisible();
  await expect(stat(page, "intros")).toHaveAttribute("aria-pressed", "true");
  await chip("all").click();
  // Catches: the All chip closing the Intros list, which it has no tile for.
  await expect(page.locator('[data-tile-panel="intros"]')).toBeVisible();
  await chip("offers").click();
  // Catches: the Offers chip leaving the Intros list open, so its own panel never replaces it (one panel at a time).
  await expect(page.locator('[data-tile-panel="offers"]')).toBeVisible();
  // Catches: the Intros list staying on screen under the Offers panel the chip just opened.
  await expect(page.locator('[data-tile-panel="intros"]')).toHaveCount(0);
  await stat(page, "intros").click();
  await stat(page, "offers").click();
  // Catches: the Offers tile opening its panel on top of the Intros list instead of replacing it.
  await expect(page.locator('[data-tile-panel="offers"]')).toBeVisible();
  // Catches: the Intros list surviving a press on the Offers tile.
  await expect(page.locator('[data-tile-panel="intros"]')).toHaveCount(0);
});

test("board table: from lg the table fits its card with no sideways scroll, no clipped cell, and every row the same height, in the All and In process views", async ({ page }) => {
  // The 1024 leg is run twice: bare, and with 15 px added to the tab panel's right padding, which is what a classic scrollbar costs the content.
  for (const [width, scrollbar] of [[1024, 0], [1024, 15], [1280, 0], [1440, 0]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await joinAs(page, "sam", true);
    if (scrollbar) await page.addStyleTag({ content: `[role=tabpanel]{padding-right: calc(0.5rem + ${scrollbar}px) !important}` });
    // Catches: a leg that runs below Tailwind's lg and so proves nothing about the lg table.
    expect(await page.evaluate(() => matchMedia("(min-width: 1024px)").matches), `lg at ${width}`).toBe(true);
    for (const view of ["all", "inProcess"]) {
      await page.locator(`[data-board-table] [data-filter="${view}"]`).click();
      for (const sort of ["next", "lastUpdate"]) {
        // Next step is the default sort; Last update is the widest header once it carries its chevron.
        if ((await th(page, sort).getAttribute("aria-sort")) === "none") await th(page, sort).getByRole("button").click();
        // Catches: a header click that does not sort, so the fit measurements below would run on the wrong sort.
        await expect(th(page, sort)).not.toHaveAttribute("aria-sort", "none");
        const where = `${view}, sorted by ${sort}, at ${width} less ${scrollbar}`;
        const gap = await page.locator("[data-table-scroll]").evaluate((el) => el.scrollWidth - el.clientWidth);
        // Catches: a table wider than its card at lg, which clips the Next step column behind a sideways scroll.
        expect(gap, `scroll overflow, ${where}`).toBeLessThanOrEqual(1);
        const clipped = await page.locator('[data-cell="next"]').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
        // Catches: a Next step cell whose action or quiet label is cut by its own cell, even when the table as a whole fits.
        expect(clipped, `clipped Next step cells, ${where}`).toBe(0);
        const spill = await page.locator('[data-board-table] [data-cell="stage"] > span, [data-board-table] th[data-col] > button').evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().right > (el.parentElement as HTMLElement).getBoundingClientRect().right + 1).length);
        // Catches: a stage chip (ASSESSMENT) or a header with its sort chevron spilling past its own column into the next, including Last update while it is the active sort (P3).
        expect(spill, `chips or headers overhanging their column, ${where}`).toBe(0);
        const tall = await page.locator("[data-board-table] th[data-col] > button").evaluateAll((els) => els.filter((el) => { const range = document.createRange(); range.selectNodeContents(el.firstChild as Node); return range.getBoundingClientRect().height > 24; }).length);
        // Catches: a header that wraps to two lines (L5), which also makes it sit off its column's text. The button keeps its 44 px floor even when its label wraps, so the label's own box is what is measured.
        expect(tall, `wrapped headers, ${where}`).toBe(0);
        const heights = await rows(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
        // Catches: no rows in the view, so the height comparison below would pass with nothing to compare.
        expect(heights.length, `rows, ${where}`).toBeGreaterThan(3);
        // Catches: wrapping in a squeezed column making some rows taller than others (L3 at the narrowest lg width).
        for (const height of heights) expect(Math.abs(height - heights[0]), `row height, ${where}`).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("board table: roles read whole within two lines at 1024, with and without a classic scrollbar", async ({ page }) => {
  for (const scrollbar of [0, 15]) {
    await page.setViewportSize({ width: 1024, height: 900 });
    await joinAs(page, "sam", true);
    if (scrollbar) await page.addStyleTag({ content: `[role=tabpanel]{padding-right: calc(0.5rem + ${scrollbar}px) !important}` });
    await page.getByRole("button", { name: /^show all \d+$/ }).click();
    const roles = page.locator('[data-board-table] [data-cell="role"] > span');
    const state = await roles.evaluateAll((els) => els.map((el) => ({ text: el.textContent ?? "", whole: el.scrollHeight <= el.clientHeight + 1 })));
    // Catches: no roles to measure, so the loop below passes for nothing.
    expect(state.length, `roles at ${scrollbar}`).toBeGreaterThan(8);
    // Catches: the pinned long roles absent from Sam's table, so the pin names nothing.
    for (const role of ["Software Engineer, New Grad", "Software Engineer, Product", "Embedded Software Engineer"]) expect(state.map((entry) => entry.text), `roles at ${scrollbar}`).toContain(role);
    // Catches: Role clamped with an ellipsis at 1024 while the date columns hold short dates in wide cells (L7).
    expect(state.filter((entry) => !entry.whole).map((entry) => entry.text), `clamped roles at ${scrollbar}`).toEqual([]);
  }
});

test("board table: a long company name clamps to the row height with the whole name kept for readers (Dev, 1024)", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await joinAs(page, "dev", true);
  await page.getByRole("button", { name: /^show all \d+$/ }).click();
  const heights = await rows(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  for (const name of ["Tidepool Founders Program", "Meridian Reach Ventures"]) {
    const row = rows(page).filter({ hasText: name }).first();
    // Catches: a name that never reaches the table, so the clamp checks below pin nothing.
    await expect(row, name).toHaveCount(1);
    // Catches: a long name growing its row past the others (three lines in a narrow column).
    expect(Math.abs((await row.boundingBox())!.height - heights[0]), `${name} row height`).toBeLessThanOrEqual(1);
    const cell = row.locator('[data-cell="company"] > span');
    // Catches: the clamp cutting the name for a reader: the full name stays in the tooltip.
    await expect(cell).toHaveAttribute("title", name);
    // Catches: the clamp removing the name from the DOM text (what a screen reader and a search read).
    expect(await cell.evaluate((el) => el.textContent)).toBe(name);
  }
});

test("board table: a Next-step link's text starts where the column's plain text does", async ({ page }) => {
  await joinAs(page, "sam", true);
  const left = (selector: string) => page.locator(selector).first().evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el.firstChild ?? el);
    return range.getBoundingClientRect().left;
  });
  const link = await left("[data-next-action]");
  const plain = await left('[data-cell="next"] > span');
  // Catches: the link's hit-area padding pushing its text 8 px right of the plain rows and the header below it (L6).
  expect(Math.abs(link - plain)).toBeLessThanOrEqual(1);
});

// ---- Task 6b: Today, warm intros and the shortlist (Rulings 51 to 55) ----

const today = (page: Page) => page.locator("[data-today-item]");
const introCards = (page: Page) => page.locator("[data-intro-card]");
const shortlistItems = (page: Page) => page.locator("[data-shortlist-item]");
const SOCIALS = siteContent.menu.socials;
const needsTitle = async (page: Page, company: string) => {
  await needs(page).filter({ hasText: company }).locator("[data-needs-action]").click();
  const title = await sheet(page).locator("#sr-sheet-title").innerText();
  await sheet(page).locator("[data-sheet-close]").click();
  // Catches: the helper leaving the sheet open, which would cover the page for what follows.
  await expect(sheet(page)).toBeHidden();
  return title;
};

test("today: the Cindermoor interview is confirmed first, then joined, and every button opens the sheet it names", async ({ page }) => {
  await joinAs(page, "sam", true);
  // Catches: Today still a bare list of sentences, with no item to act on.
  await expect(today(page)).toHaveCount(3);
  const cinder = today(page).filter({ hasText: "Cindermoor Cloud" });
  // Catches: the interview row dropping the interviewer, the call's time or the confirm-by date (Ruling 51).
  await expect(cinder.locator("[data-today-who]")).toContainText("Aaron Sulbaran");
  // Catches: the call's time missing from the interview row (Ruling 51).
  await expect(cinder.locator("[data-today-when]")).toHaveText(/Nov 16/);
  // Catches: the interview row still saying Due, when the visitor has to confirm by that day.
  await expect(cinder.locator("[data-today-due]")).toHaveText(COPY.today.confirmBy(shortDay("2026-11-11")));
  // Catches: Join offered before the interview is confirmed, so Today and Needs you disagree about what comes next.
  await expect(cinder.getByRole("button", { name: COPY.today.join })).toHaveCount(0);
  const needsSheetTitle = await needsTitle(page, "Cindermoor Cloud");
  await cinder.getByRole("button", { name: ACTIONS.briefButtons.confirmInterview }).click();
  // Catches: Confirm opening a different sheet from the Needs you item for the same interview.
  await expect(sheet(page).locator("#sr-sheet-title")).toHaveText(needsSheetTitle);
  await sheet(page).locator("[data-sheet-confirm]").click();
  // Catches: a confirm in Today that leaves the sheet open.
  await expect(sheet(page)).toBeHidden();
  // Catches: a decision made in Today that the Needs you list never hears of (two clocks for one action).
  await expect(needs(page).filter({ hasText: "Cindermoor Cloud" })).toHaveAttribute("data-done", "true");
  // Catches: the count ignoring a decision made in Today.
  await expect(countLine(page)).toHaveText(COPY.count(3));
  // Catches: Join still missing after the confirmation.
  await expect(cinder.getByRole("button", { name: COPY.today.join })).toBeVisible();
  // Catches: a row that dims on confirm although the call is still to join.
  await expect(cinder).toHaveAttribute("data-done", "false");
  await cinder.getByRole("button", { name: COPY.today.calendar }).click();
  // Catches: a dead Add to calendar.
  await expect(sheet(page)).toBeVisible();
  const title = await sheet(page).locator("#sr-sheet-title").innerText();
  await sheet(page).locator("[data-sheet-close]").click();
  // Catches: Not now leaving the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  await cinder.getByRole("button", { name: COPY.today.join }).click();
  // Catches: a dead Join, a button that opens nothing.
  await expect(sheet(page)).toBeVisible();
  // Catches: Join opening a different sheet from Add to calendar (Ruling 51 says the same sheet).
  await expect(sheet(page).locator("#sr-sheet-title")).toHaveText(title);
  // Catches: the made-up meeting link missing from the sheet.
  await expect(sheet(page).locator("[data-sheet-meeting-link]")).toHaveText("https://meet.example/cindermoor-interview");
  // Catches: a sheet that hides what the real version would do, or promises a real call.
  await expect(sheet(page).locator("[data-sheet-note]")).toContainText("the real version opens Meet or Zoom");
  await sheet(page).locator("[data-sheet-confirm]").click();
  // Catches: a confirm that leaves the sheet open over the page.
  await expect(sheet(page)).toBeHidden();
  // Catches: the other rows kept (a settled call stays in place, dimmed, and is not removed).
  await expect(today(page)).toHaveCount(3);
  // Catches: a joined call that does not look done (it should dim in place).
  await expect(cinder).toHaveAttribute("data-done", "true");
  // Catches: a settled call that keeps a live button, which could join it twice.
  await expect(cinder.getByRole("button")).toHaveCount(0);
  // Catches: focus dropping to the page when the buttons are swapped for the quiet check, which should take it.
  await expect(cinder.locator("[data-action-done]")).toBeFocused();
  // Catches: the other Today items marked done along with it.
  await expect(today(page).filter({ hasText: "Lumora Health" })).toHaveAttribute("data-done", "false");
});

test("today: confirming the interview in Needs you turns Today's row to Join", async ({ page }) => {
  await joinAs(page, "sam", true);
  const cinder = today(page).filter({ hasText: "Cindermoor Cloud" });
  await needs(page).filter({ hasText: "Cindermoor Cloud" }).locator("[data-needs-action]").click();
  await sheet(page).locator("[data-sheet-confirm]").click();
  // Catches: Today keeping Confirm for an interview already confirmed in Needs you.
  await expect(cinder.getByRole("button", { name: COPY.today.join })).toBeVisible();
  // Catches: Confirm still offered once the interview is confirmed.
  await expect(cinder.getByRole("button", { name: ACTIONS.briefButtons.confirmInterview })).toHaveCount(0);
});

test("today: a founder's reply offers three times to pick from, and a prepare item opens to three points", async ({ page }) => {
  await joinAs(page, "sam", true);
  const lumora = today(page).filter({ hasText: "Lumora Health" });
  await lumora.getByRole("button", { name: COPY.nextStep.pickTime }).click();
  // Catches: Pick a time opening a sheet with no times to pick.
  await expect(sheet(page).locator("[data-sheet-slot]")).toHaveCount(3);
  await sheet(page).locator("[data-sheet-close]").click();
  await joinAs(page, "dev", true);
  const prep = today(page).filter({ has: page.locator("[data-today-prep]") }).first();
  // Catches: a prepare item with no drop-down, so nothing says what to know.
  await expect(prep).toBeVisible();
  const toggle = prep.locator("[data-today-prep] > summary");
  await toggle.click();
  // Catches: a drop-down that opens onto fewer than the three points.
  await expect(prep.locator("[data-today-prep] li")).toHaveCount(3);
});

test("warm intros: the min/Max card names Aaron with a monogram, links LinkedIn, shows a status chip and prepares, never picks a time", async ({ page }) => {
  await joinAs(page, "sam", true);
  const card = introCards(page).filter({ hasText: "min/Max" });
  // Catches: min/Max missing from the intros, the one real flow.
  await expect(card).toHaveCount(1);
  // Catches: dead intro data: no person, or a person who is not Aaron.
  await expect(card).toContainText("Aaron Sulbaran");
  // Catches: a person with no monogram, which the ruling asks for in place of a photo.
  await expect(card.locator("[data-intro-monogram]")).toHaveText("AS");
  const linkedin = SOCIALS.find((social) => social.key === "linkedin")!;
  const link = card.getByRole("link", { name: /LinkedIn/ });
  // Catches: a LinkedIn link that goes anywhere but the socials URL.
  await expect(link).toHaveAttribute("href", linkedin.href);
  // Catches: a LinkedIn link that opens in this tab.
  await expect(link).toHaveAttribute("target", "_blank");
  // Catches: an external link without noopener noreferrer.
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const x = SOCIALS.find((social) => (social.key as string) === "x");
  // Catches: an X link made up when the socials hold none, or missing when they do.
  await expect(card.getByRole("link", { name: /on X$/ })).toHaveCount(x ? 1 : 0);
  // Catches: a status chip with no words, or a status that disagrees with the pinned detail.
  await expect(card.locator("[data-intro-status]")).toHaveText(COPY.introStatus.scheduled);
  // Catches: a scheduled intro with no Prepare nudge.
  await expect(card.getByRole("button", { name: COPY.nextStep.prepare })).toBeVisible();
  // Catches: a scheduled intro offering "Pick a time" (Ruling 58). Today holds no min/Max item on this day, so the Today side of the agreement is pinned in lib/speedrun/actions.test.ts.
  await expect(card.getByRole("button", { name: COPY.nextStep.pickTime })).toHaveCount(0);
  await card.getByRole("button", { name: COPY.nextStep.prepare }).click();
  // Catches: a nudge that opens nothing.
  await expect(sheet(page).locator("[data-sheet-meeting-link]")).toContainText("meet.example/minmax-intro");
  await sheet(page).locator("[data-sheet-close]").click();
  await card.getByRole("button", { name: COPY.today.calendar }).click();
  // Catches: Add to calendar opening the Prepare sheet instead of the call's (fix 7).
  await expect(sheet(page).locator("#sr-sheet-title")).toHaveText(ACTIONS.sheets.joinMeeting.title("min/Max"));
});

test("warm intros: every card's status chip starts at the same x, with or without an action, at 1440", async ({ page }) => {
  let matches: { company: { name: string }; connect: string[] }[] = [];
  await page.route("**/speedrun/api/match", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { result: { matches: typeof matches } };
    matches = body.result.matches;
    await route.fulfill({ response, json: body });
  });
  await joinAs(page, "sam", true);
  await openTab(page, speedrunCopy.network.tabs.matches);
  const first = matches.findIndex((match) => match.connect.includes("intro"));
  await page.locator("[data-row-bring-forward]").nth(first).click();
  await page.locator("[data-match-row]").nth(first).click();
  await page.locator("[data-match-detail] [data-request-intro]").click();
  await openTab(page, speedrunCopy.network.tabs.board);
  const lefts = await introCards(page).locator("[data-intro-status]").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
  // Catches: too few cards, or no request card, so the comparison below proves nothing.
  expect(lefts.length).toBeGreaterThan(3);
  // Catches: the request card's chip missing from the first card (the pin below needs it there).
  await expect(introCards(page).first().locator("[data-intro-status]")).toHaveText(COPY.introStatus.requested);
  // Catches: the request card (no action) putting its chip in a different column from the others (M1).
  for (const left of lefts) expect(Math.abs(left - lefts[0]), "chip column").toBeLessThanOrEqual(1);
});

test("an inline link keeps the spaces of its sentence (M3)", async ({ page }) => {
  await joinAs(page, "sam", true);
  const gap = await page.locator('[data-board-section="shortlist"] [data-shortlist-empty] button').evaluate((link) => {
    const text = document.createRange();
    text.selectNodeContents(link);
    const next = link.nextSibling as Text;
    const start = next.data.search(/\S/);
    const after = document.createRange();
    after.setStart(next, start);
    after.setEnd(next, start + 1);
    return after.getBoundingClientRect().left - text.getBoundingClientRect().right;
  });
  // Catches: a link whose hit-area padding shows as a wide gap before the next word. One space is about 4 px.
  expect(gap).toBeLessThan(6);
});

test("warm intros: the count is the Intros tile's count, one card per company", async ({ page }) => {
  await joinAs(page, "sam", true);
  // Catches: the section listing intro emails (two from one company listed twice) instead of the cards the tile counts (C4).
  expect(await introCards(page).count()).toBe(await statValue(page, "intros"));
  const names = await introCards(page).locator("[data-intro-company]").allInnerTexts();
  // Catches: one company listed twice.
  expect(new Set(names).size).toBe(names.length);
});

test("shortlist: moving #2 up makes it #1, and the intro request stays on its match", async ({ page }) => {
  let matches: { company: { name: string }; role: { title: string } | null; connect: string[] }[] = [];
  await page.route("**/speedrun/api/match", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { result: { matches: typeof matches } };
    matches = body.result.matches;
    await route.fulfill({ response, json: body });
  });
  await joinAs(page, "sam", true);
  await openTab(page, speedrunCopy.network.tabs.matches);
  const eligible = matches.flatMap((match, at) => (match.connect.includes("intro") ? [at] : []));
  // Catches: a fixture with fewer than two intro-eligible matches, which would pass the moves below for nothing.
  expect(eligible.length).toBeGreaterThanOrEqual(2);
  const [a, b] = eligible;
  await page.locator("[data-row-bring-forward]").nth(a).click();
  await page.locator("[data-row-bring-forward]").nth(b).click();
  await page.locator("[data-match-row]").nth(a).click();
  await page.locator("[data-match-detail] [data-request-intro]").click();
  await openTab(page, speedrunCopy.network.tabs.board);
  const names = () => shortlistItems(page).locator("[data-shortlist-company]").allInnerTexts();
  // Catches: a Board that shows no shortlist, or one in the wrong order.
  expect(await names()).toEqual([matches[a].company.name, matches[b].company.name]);
  // Catches: the request's status missing from #1, where the request sits.
  await expect(shortlistItems(page).first().locator("[data-shortlist-status]")).toContainText(COPY.introStatus.requested);
  // Catches: the request's status shown on #2 as well, which would read as two requests.
  await expect(shortlistItems(page).nth(1).locator("[data-shortlist-status]")).toHaveCount(0);
  // Catches: a first item that can still move up.
  await expect(shortlistItems(page).first().locator("[data-shortlist-up]")).toBeDisabled();
  // Catches: a last item that can still move down.
  await expect(shortlistItems(page).nth(1).locator("[data-shortlist-down]")).toBeDisabled();
  await shortlistItems(page).nth(1).locator("[data-shortlist-up]").click();
  // Catches: focus lost to the page when a moved item changes place (it should stay on the moved item's button).
  await expect(shortlistItems(page).first().locator("[data-shortlist-down]")).toBeFocused();
  // Catches: a Move up that does nothing, or moves the wrong item.
  expect(await names()).toEqual([matches[b].company.name, matches[a].company.name]);
  // Catches: the request following the new #1 (Review Focus 2): it stays on the match that was asked for.
  await expect(shortlistItems(page).nth(1).locator("[data-shortlist-status]")).toContainText(COPY.introStatus.requested);
  // Catches: the status left on the old #1 after the move, so the request looks like it followed the rank.
  await expect(shortlistItems(page).first().locator("[data-shortlist-status]")).toHaveCount(0);
  // Catches: the rank number read twice by a screen reader (the visible one is decoration, the list carries the number).
  await expect(shortlistItems(page).first().locator("[data-shortlist-position]")).toHaveAttribute("aria-hidden", "true");
  const edge = (selector: string) => page.locator(selector).first().evaluate((el) => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect().left; });
  // Catches: Back to Matches sitting off the list's left edge by its hit-area padding (M3).
  expect(Math.abs((await edge("[data-shortlist-matches]")) - (await edge("[data-shortlist-position]")))).toBeLessThanOrEqual(1);
  // Catches: the warm intros section forgetting a live request, which Ruling 52 says shows there too.
  await expect(introCards(page).first().locator("[data-intro-status]")).toHaveText(COPY.introStatus.requested);
  // Catches: the request card naming the wrong company after the move.
  await expect(introCards(page).first()).toContainText(matches[a].company.name);
  await page.locator("[data-shortlist-matches]").click();
  // Catches: a Back to Matches button that looks live and leaves the visitor on the Board.
  await expect(page.getByRole("tab", { name: speedrunCopy.network.tabs.matches, exact: true })).toHaveAttribute("aria-selected", "true");
});

test("shortlist: with no picks it says how to fill it, and the link goes to Matches", async ({ page }) => {
  await joinAs(page, "sam", true);
  const section = page.locator('[data-board-section="shortlist"]');
  // Catches: an empty shortlist drawn as nothing, so the visitor never learns where picks come from.
  await expect(section).toContainText(COPY.shortlist.empty.after.trim());
  // Catches: an empty-state Shortlist that still lists items.
  await expect(shortlistItems(page)).toHaveCount(0);
  await section.getByRole("button", { name: COPY.shortlist.empty.link }).click();
  // Catches: a link that looks live and leaves the visitor on the Board.
  await expect(page.getByRole("tab", { name: speedrunCopy.network.tabs.matches, exact: true })).toHaveAttribute("aria-selected", "true");
});

test("board: the paste box, the Arrange toggle and the card controls are gone, and Tools is the last section", async ({ page }) => {
  await joinAs(page, "sam", true);
  // Catches: the paste box returning.
  await expect(page.locator("[data-board] textarea")).toHaveCount(0);
  // Catches: the Arrange toggle returning.
  await expect(page.locator("[data-board]").getByRole("button", { name: /arrange/i })).toHaveCount(0);
  // Catches: the per-card move, hide and show controls returning.
  await expect(page.locator("[data-board] [data-card-move], [data-board] [data-card-hide], [data-board] [data-card-show]")).toHaveCount(0);
  // Catches: Tools moving up above the sections that need the visitor.
  const order = await page.locator("[data-board] [data-board-section]").evaluateAll((els) => els.map((el) => el.getAttribute("data-board-section")));
  // Catches: the sections out of order: Today, Warm intros, Shortlist, then Tools last.
  expect(order).toEqual(["today", "intros", "shortlist", "tools"]);
});

test("board lower sections: on a phone every control is 44 px and the page never scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await joinAs(page, "dev", true);
  await openTab(page, speedrunCopy.network.tabs.matches);
  await page.locator("[data-row-bring-forward]").first().click();
  await page.locator("[data-row-bring-forward]").nth(1).click();
  await openTab(page, speedrunCopy.network.tabs.board);
  const controls = page.locator("[data-board-section] button, [data-board-section] summary, [data-board-section] a");
  const sizes = await controls.evaluateAll((els) => els.map((el) => [(el.textContent ?? el.getAttribute("aria-label"))?.trim().slice(0, 24), el.getBoundingClientRect().width, el.getBoundingClientRect().height] as const));
  // Catches: the selector matching almost nothing, so the size loop below checks no controls at all.
  expect(sizes.length).toBeGreaterThan(8);
  // Catches: a Today, intro, shortlist or tools control under the 44 px touch size (Ruling 68).
  for (const [label, width, height] of sizes) {
    // Catches: a Today, intro, shortlist or tools control under 44 px wide (Ruling 68).
    expect(width, `${label} width`).toBeGreaterThanOrEqual(43.95);
    // Catches: a Today, intro, shortlist or tools control under 44 px tall (Ruling 68).
    expect(height, `${label} height`).toBeGreaterThanOrEqual(43.95);
  }
  // Catches: the new sections pushing the page, or the tab's own scroll area, wider than the phone.
  expect(await page.evaluate(() => { const panel = document.querySelector('[role="tabpanel"]:not([hidden])'); return document.documentElement.scrollWidth <= document.documentElement.clientWidth && !!panel && panel.scrollWidth <= panel.clientWidth; })).toBe(true);
});
