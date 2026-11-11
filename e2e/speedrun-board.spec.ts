import { speedrunCopy } from "../lib/content";
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

test("Arrange moves a card down and hides one, keeping focus", async ({ page }) => {
  await joinAs(page, "sam", true);
  const order = () => page.locator("[data-board-card]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-board-card")));
  const first = await order();
  const name = (card: string | null) => COPY.cardNames[card as keyof typeof COPY.cardNames];
  await page.getByRole("button", { name: COPY.arrange.button }).click();
  const down = page.getByRole("button", { name: `${COPY.arrange.down}: ${name(first[0])}` });
  await down.click();
  expect(await order()).toEqual([first[1], first[0], ...first.slice(2)]);
  await expect(down).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: name(first[0]) })).toBeAttached();
  // The first card's Move up is inert but still focusable, so focus never falls out of the list.
  const topUp = page.getByRole("button", { name: `${COPY.arrange.up}: ${name(first[1])}` });
  await expect(topUp).toHaveAttribute("aria-disabled", "true");
  await topUp.focus();
  await page.keyboard.press("Enter");
  expect(await order()).toEqual([first[1], first[0], ...first.slice(2)]);
  await expect(topUp).toBeFocused();
  await page.getByRole("button", { name: `${COPY.arrange.hide}: ${COPY.cardNames.tools}` }).click();
  await expect(page.locator("[data-board-card=tools]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `${COPY.arrange.show}: ${COPY.cardNames.tools}` })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-board-card=tools]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: `${COPY.arrange.hide}: ${COPY.cardNames.tools}` })).toBeFocused();
  await page.getByRole("button", { name: COPY.arrange.done }).click();
  await expect(page.getByRole("button", { name: COPY.arrange.up })).toHaveCount(0);
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
