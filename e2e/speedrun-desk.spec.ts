import { speedrunCopy } from "../lib/content";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { accountButton, networkPhase, openTab, skipBuildLog, skipToSam, startOver } from "./speedrun-flow";

const TAB = speedrunCopy.network.tabs;
const SWITCH = speedrunCopy.team.switch;
const TABS = [TAB.matches, TAB.board, TAB.brief, TAB.decisions];

const group = (page: Page) => page.locator("[data-side-switch]");
const candidateButton = (page: Page) => group(page).getByRole("button", { name: SWITCH.candidate, exact: true });
const teamButton = (page: Page) => group(page).getByRole("button", { name: SWITCH.team, exact: true });
const desk = (page: Page) => page.locator("[data-desk]");

async function toNetwork(page: Page) {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
}

test("switch: Talent team shows the desk and hides the tabs from every tab, and Candidate returns to the same tab", async ({ page }) => {
  await toNetwork(page);
  await expect(group(page)).toHaveAccessibleName(SWITCH.label);
  await expect(candidateButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(networkPhase(page)).toHaveAttribute("data-side", "candidate");
  for (const label of TABS) {
    await openTab(page, label);
    await teamButton(page).click();
    // Catches: a switch that only works from one tab.
    await expect(desk(page)).toBeVisible();
    await expect(page.getByRole("tablist")).toBeHidden();
    await expect(networkPhase(page)).toHaveAttribute("data-side", "team");
    await expect(teamButton(page)).toHaveAttribute("aria-pressed", "true");
    await candidateButton(page).click();
    await expect(desk(page)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
  }
});

test("switch: the candidate side returns exactly as left, with the same match selected", async ({ page }) => {
  await toNetwork(page);
  await openTab(page, TAB.matches);
  const rows = page.locator("[data-match-row]");
  await expect(rows.first()).toBeVisible();
  const target = rows.nth(1);
  await target.click();
  const key = await target.getAttribute("data-match-row");
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
  await candidateButton(page).click();
  // Catches: the candidate side resetting on a flip (unmounted panels, a reselected first row).
  await expect(page.locator(`[data-match-row="${key}"][aria-current="true"]`)).toBeVisible();
});

test("switch: focus stays on the pressed button after a flip", async ({ page }) => {
  await toNetwork(page);
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
  // Catches: focus dropped to body when the panels swap.
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(SWITCH.team);
  await candidateButton(page).click();
  await expect(desk(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(SWITCH.candidate);
});

test("switch: Start over from the team side, then a rebuild, lands on the candidate side", async ({ page }) => {
  await toNetwork(page);
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
  await startOver(page);
  await expect(page.locator('#act-2[data-phase="join"]')).toBeVisible({ timeout: 8000 });
  await skipToSam(page);
  await skipBuildLog(page);
  // Catches: a stale team side surviving Start over (Review Focus 1).
  await expect(networkPhase(page)).toHaveAttribute("data-side", "candidate");
  await expect(desk(page)).toHaveCount(0);
  await expect(page.getByRole("tablist")).toBeVisible();
});

for (const width of [320, 390, 640, 1024, 1440]) {
  test(`switch: both labels fit and the page does not scroll sideways at ${width} wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await toNetwork(page);
    const probe = await page.evaluate(() => {
      const labels = [...document.querySelectorAll<HTMLElement>("[data-side-switch] button")];
      const rects = labels.map((node) => node.getBoundingClientRect());
      return {
        cut: labels.map((node) => node.scrollWidth > node.clientWidth),
        sizes: rects.map((rect) => ({ w: rect.width, h: rect.height, inside: rect.left >= 0 && rect.right <= window.innerWidth })),
        page: document.documentElement.scrollWidth,
      };
    });
    // Catches: a cut label, or a sideways scroll.
    expect(probe.cut).toEqual([false, false]);
    expect(probe.page).toBe(width);
    for (const size of probe.sizes) {
      // Catches: a tap target under 44 by 44, or a button pushed off the edge.
      expect(size.w).toBeGreaterThanOrEqual(44);
      expect(size.h).toBeGreaterThanOrEqual(44);
      expect(size.inside).toBe(true);
    }
  });
}

const box = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, mid: (r.top + r.bottom) / 2 };
  });

for (const width of [640, 768]) {
  test(`switch: at ${width} the avatar stays in the top row and the switch takes its own row below`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await toNetwork(page);
    const avatar = await accountButton(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { right: r.right, top: r.top, bottom: r.bottom, mid: (r.top + r.bottom) / 2 };
    });
    const bar = await box(page, "[data-shell] header");
    const wordmark = await box(page, "[data-shell] header span");
    // Catches: the avatar wrapping to a second row (its menu then opens off screen).
    expect(bar.right - avatar.right).toBeLessThanOrEqual(32);
    expect(Math.abs(avatar.mid - wordmark.mid)).toBeLessThanOrEqual(4);
    const pill = await box(page, "[data-side-switch]");
    // Catches: the switch squeezed into the top row.
    expect(pill.top).toBeGreaterThanOrEqual(avatar.bottom);
    expect(Math.abs(pill.right - avatar.right)).toBeLessThanOrEqual(2);
  });
}

for (const width of [1024, 1280, 1440]) {
  test(`switch: at ${width} the tablist ends before the switch slot`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await toNetwork(page);
    const tabs = await box(page, '[role="tablist"]');
    const slot = await box(page, "[data-shell-switch-slot]");
    // Catches: the tabs running under the switch.
    expect(tabs.right).toBeLessThanOrEqual(slot.left);
  });
}

test("switch: at 375 the two buttons are equal halves", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await toNetwork(page);
  const widths = await page.locator("[data-side-switch] button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
  // Catches: unequal halves on the phone row.
  expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
});
