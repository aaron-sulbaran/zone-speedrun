import { speedrunCopy } from "../lib/content";
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

const INTERVIEW_EMAIL = [
  "From: Halcyon Works Hiring <hiring@halcyonworks.example>",
  "Subject: Interview invitation: Software Engineer",
  "",
  "We would like to invite you to a final round interview.",
  "Role: Software Engineer",
].join("\n");

test("pasting an interview invite moves the funnel", async ({ page }) => {
  await joinAs(page, "sam", true);
  await expect(stat(page, "inProcess")).toBeVisible();
  const before = await statValue(page, "inProcess");
  await page.getByLabel(COPY.paste.label).fill(INTERVIEW_EMAIL);
  await page.getByRole("button", { name: COPY.paste.button }).click();
  await expect(page.locator("[data-paste-status]")).toHaveText(COPY.paste.found(COPY.kindLabels.interview, "Halcyon Works"));
  // A tap on the button must not pull focus into the box (it would open a phone keyboard); the button keeps it.
  await expect(page.getByRole("button", { name: COPY.paste.button })).toBeFocused();
  await expect(page.getByRole("button", { name: COPY.paste.button })).toHaveAttribute("aria-disabled", "true");
  await expect(stat(page, "inProcess")).toHaveAttribute("data-value", String(before + 1));
  await expect(page.locator("[data-today-list]")).toContainText("Halcyon Works");
});

test("the visible stat number follows a paste, with motion", async ({ page }) => {
  await joinAs(page, "sam", true);
  const visible = stat(page, "inProcess").locator('[aria-hidden="true"]');
  const before = await statValue(page, "inProcess");
  await expect(visible).toHaveText(String(before));
  await page.getByLabel(COPY.paste.label).fill(INTERVIEW_EMAIL);
  await page.getByRole("button", { name: COPY.paste.button }).click();
  await expect(visible).toHaveText(String(before + 1));
});

test("pasting the same email twice adds it once", async ({ page }) => {
  await joinAs(page, "sam", true);
  const paste = page.getByLabel(COPY.paste.label);
  await paste.fill(INTERVIEW_EMAIL);
  await page.getByRole("button", { name: COPY.paste.button }).click();
  const applied = await statValue(page, "applied");
  await paste.fill(INTERVIEW_EMAIL);
  await page.getByRole("button", { name: COPY.paste.button }).click();
  await expect(page.locator("[data-paste-status]")).toHaveText(COPY.paste.duplicate);
  expect(await statValue(page, "applied")).toBe(applied);
});

test("a paste with no sender is not added as Unknown", async ({ page }) => {
  await joinAs(page, "sam", true);
  const applied = await statValue(page, "applied");
  await page.getByLabel(COPY.paste.label).fill("Interview invitation\nWe would like to invite you to a final round interview.");
  await page.getByRole("button", { name: COPY.paste.button }).click();
  await expect(page.locator("[data-paste-status]")).toHaveText(COPY.paste.unknownSender);
  expect(await statValue(page, "applied")).toBe(applied);
});

test("a paste that is not a hiring email leaves the board alone", async ({ page }) => {
  await joinAs(page, "sam", true);
  const before = await statValue(page, "applied");
  await page.getByLabel(COPY.paste.label).fill("Weekly newsletter\nTen recipes you will love.");
  await page.getByRole("button", { name: COPY.paste.button }).click();
  await expect(page.locator("[data-paste-status]")).toHaveText(COPY.paste.unknown);
  expect(await statValue(page, "applied")).toBe(before);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the visible stat number is final on arrival and after a paste", async ({ page }) => {
    await joinAs(page, "sam", true);
    const visible = stat(page, "inProcess").locator('[aria-hidden="true"]');
    const before = await statValue(page, "inProcess");
    await expect(visible).toHaveText(String(before));
    await page.getByLabel(COPY.paste.label).fill(INTERVIEW_EMAIL);
    await page.getByRole("button", { name: COPY.paste.button }).click();
    await expect(visible).toHaveText(String(before + 1));
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
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator("[data-sheet-confirm]").click();
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
  expect(before).toBe(COPY.count(4));
  await openTab(page, speedrunCopy.network.tabs.brief);
  await page.locator('[data-brief-action="pickTime"]').click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator("[data-sheet-slot]").nth(1).click();
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
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator("#sr-sheet-title")).toContainText("Wrenfield");
  await sheet(page).locator("[data-sheet-close]").click();
  await expect(sheet(page)).toBeHidden();
  await tile.click();
  // Catches: a pressed tile that cannot be un-pressed.
  await expect(tile).toHaveAttribute("aria-pressed", "false");
  await expect(panel).toHaveCount(0);
  await expect(rows(page)).toHaveCount(8);
});

test("board top: the Intros tile lists the warm intros with who they are with and where they stand", async ({ page }) => {
  await joinAs(page, "sam", true);
  await stat(page, "intros").click();
  const panel = page.locator('[data-tile-panel="intros"]');
  // Catches: an Intros drop-down that lists companies with no person or status.
  await expect(panel.locator("[data-tile-item]").filter({ hasText: "Lumora Health" })).toContainText("Aaron Sulbaran");
  await expect(panel.locator("[data-tile-item]").filter({ hasText: "Lumora Health" })).toContainText(COPY.introStatus.replied);
  await expect(panel.locator("[data-tile-item]").filter({ hasText: "min/Max" })).toContainText(COPY.introStatus.scheduled);
  // Catches: the Intros tile not setting the table's filter.
  await expect(page.locator('[data-board-table] [data-filter="intros"]')).toHaveAttribute("aria-pressed", "true");
});

test("board table: stage chips and tiles stay in step", async ({ page }) => {
  await joinAs(page, "sam", true);
  const chip = (key: string) => page.locator(`[data-board-table] [data-filter="${key}"]`);
  await expect(chip("all")).toHaveAttribute("aria-pressed", "true");
  await chip("closed").click();
  const closed = [speedrunCopy.flow.exits.rejected, speedrunCopy.flow.exits.noreply];
  const labels = await rows(page).locator('[data-cell="stage"]').allTextContents();
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
  await expect(sheet(page)).toBeHidden();
  await wren.locator("[data-next-action]").click();
  // Catches: the table link opening a different sheet from the same action's other entrance.
  await expect(sheet(page).locator("#sr-sheet-title")).toHaveText(fromNeeds);
  await sheet(page).locator("[data-sheet-confirm]").click();
  await expect(sheet(page)).toBeHidden();
  // Catches: focus dropping to the page when the link is swapped for the quiet check.
  await expect(wren.locator("[data-action-done]")).toBeFocused();
  // Catches: a decision made in the table that the needs-you list never hears of (two clocks for one action).
  await expect(needs(page).first()).toHaveAttribute("data-done", "true");
});

test("board table: on a phone the table scrolls inside its own box, the page never scrolls sideways, and every new control is 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await joinAs(page, "sam", true);
  // Catches: the table pushing the whole page wider than the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const box = page.locator("[data-table-scroll]");
  // Catches: a table squeezed to fit, with no sideways scroll of its own.
  expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(box).toHaveCSS("overflow-x", "auto");
  // Catches: any new control under the 44 px touch size (Ruling 68), tiles and chips and headers and links included.
  const controls = page.locator("[data-needs-action], [data-needs-toggle], [data-stat], [data-board-table] [data-filter], [data-board-table] th button, [data-next-action], [data-board-table] button[aria-expanded]");
  expect(await controls.count()).toBeGreaterThan(20);
  const sizes = await controls.evaluateAll((els) => els.map((el) => [el.textContent?.trim().slice(0, 20), el.getBoundingClientRect().width, el.getBoundingClientRect().height] as const));
  // 43.95 and not 44: a min-h-11 button lays out at 43.99997 px here, which is 44 px to a thumb.
  for (const [label, width, height] of sizes) {
    expect(width, `${label} width`).toBeGreaterThanOrEqual(43.95);
    expect(height, `${label} height`).toBeGreaterThanOrEqual(43.95);
  }
  // Catches: a tile drop-down narrower than the phone, instead of stacking full width.
  await stat(page, "offers").click();
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
  await expect(page.getByLabel(COPY.paste.label)).toBeVisible();
  // Catches: a Matches control that leaves the visitor on the Board.
  await page.locator("[data-board-empty]").getByRole("button", { name: COPY.empty.matches }).click();
  await expect(page.getByRole("tab", { name: speedrunCopy.network.tabs.matches, exact: true })).toHaveAttribute("aria-selected", "true");
});
