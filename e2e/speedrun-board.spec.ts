import { speedrunCopy } from "../lib/content";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";

const COPY = speedrunCopy.board;

async function joinAs(page: Page, key: "sam" | "dev", connected: boolean) {
  await page.goto("/speedrun");
  const card = page.locator("#join");
  await card.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await card.getByRole("button", { name: speedrunCopy.join.next }).click();
  await card.locator(`[data-person="${key}"]`).click();
  if (connected) await card.getByRole("button", { name: speedrunCopy.join.connect.gmail }).click();
  await card.getByRole("button", { name: speedrunCopy.join.finish }).click();
  await page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip }).click();
  await expect(page.locator("[data-board]")).toBeVisible({ timeout: 20_000 });
}

const stat = (page: Page, key: string) => page.locator(`[data-stat=${key}]`);
const statValue = async (page: Page, key: string) => Number(await stat(page, key).getAttribute("data-value"));

const INTERVIEW_EMAIL = [
  "From: Halcyon Works Hiring <hiring@halcyonworks.com>",
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
  await expect(stat(page, "inProcess")).toHaveAttribute("data-value", String(before + 1));
  await expect(page.locator("[data-today-list]")).toContainText("Halcyon Works");
});

test("a paste that is not a hiring email leaves the board alone", async ({ page }) => {
  await joinAs(page, "sam", true);
  const before = await statValue(page, "applied");
  await page.getByLabel(COPY.paste.label).fill("Weekly newsletter\nTen recipes you will love.");
  await page.getByRole("button", { name: COPY.paste.button }).click();
  await expect(page.locator("[data-paste-status]")).toHaveText(COPY.paste.unknown);
  expect(await statValue(page, "applied")).toBe(before);
});

test("without Gmail the board asks to connect, and one click builds it", async ({ page }) => {
  await joinAs(page, "sam", false);
  const prompt = page.locator("[data-connect-prompt]");
  await expect(prompt).toContainText(COPY.connectPrompt);
  await expect(page.locator("[data-board-stats]")).toHaveCount(0);
  await prompt.getByRole("button", { name: COPY.connectButton }).click();
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

test("Arrange moves a card down and hides one", async ({ page }) => {
  await joinAs(page, "sam", true);
  const order = () => page.locator("[data-board-card]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-board-card")));
  const first = await order();
  await page.getByRole("button", { name: COPY.arrange.button }).click();
  await page.getByRole("button", { name: `${COPY.arrange.down}: ${COPY.cardNames[first[0] as keyof typeof COPY.cardNames]}` }).click();
  expect(await order()).toEqual([first[1], first[0], ...first.slice(2)]);
  await expect(page.getByRole("status").filter({ hasText: COPY.cardNames[first[0] as keyof typeof COPY.cardNames] })).toBeAttached();
  await page.getByRole("button", { name: `${COPY.arrange.hide}: ${COPY.cardNames.tools}` }).click();
  await expect(page.locator("[data-board-card=tools]")).toHaveCount(0);
  await page.getByRole("button", { name: `${COPY.arrange.show}: ${COPY.cardNames.tools}` }).click();
  await expect(page.locator("[data-board-card=tools]")).toHaveCount(1);
  await page.getByRole("button", { name: COPY.arrange.done }).click();
  await expect(page.getByRole("button", { name: COPY.arrange.up })).toHaveCount(0);
});

test("the tools card links the six real pages", async ({ page }) => {
  await joinAs(page, "dev", true);
  const links = page.locator("[data-tools-list] a");
  await expect(links).toHaveCount(6);
  await expect(links.first()).toHaveAttribute("href", "https://speedrun-talent-network.com/jobs");
  await expect(links.first()).toHaveAttribute("target", "_blank");
});
