import { speedrunCopy } from "../lib/content";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { accountButton, networkPhase, openTab, skipBuildLog, skipToSam, spendIntro, startOver } from "./speedrun-flow";

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
  test(`switch: at ${width} no tab is covered by the switch`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await toNetwork(page);
    const probe = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
      const hit = tabs.map((tab) => {
        const r = tab.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && tab.contains(top);
      });
      const last = tabs[tabs.length - 1].getBoundingClientRect();
      const group = document.querySelector("[data-side-switch]")!.getBoundingClientRect();
      // On its own row the switch cannot touch the tabs; only a shared row needs horizontal clearance.
      const sharedRow = group.top < last.bottom && group.bottom > last.top;
      return { hit, gap: sharedRow ? group.left - last.right : Infinity };
    });
    // Catches: the switch covering a tab (the tablist's own box can look clear while its buttons overflow it).
    expect(probe.hit).toEqual([true, true, true, true]);
    // Catches: the last tab ending under or against the switch.
    expect(probe.gap).toBeGreaterThanOrEqual(8);
  });
}

test("switch: at 375 the two buttons are equal halves", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await toNetwork(page);
  const widths = await page.locator("[data-side-switch] button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
  // Catches: unequal halves on the phone row.
  expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
});

const TEAM = speedrunCopy.team;
const STAGES = ["requested", "withFounder", "connected", "tracking", "outcome"];

async function toDesk(page: Page, spend: boolean) {
  await toNetwork(page);
  if (spend) await spendIntro(page);
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
}

const strip = (page: Page) => page.locator("[data-stage-strip] button");
const docFits = (page: Page) => page.evaluate(() => ({ wide: document.documentElement.scrollWidth, width: window.innerWidth }));

test("desk board: at 1440 five columns share a row, counts sum to ten, and the visitor's card leads Requested", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toDesk(page, true);
  const columns = page.locator("[data-desk-column]");
  await expect(columns).toHaveCount(5);
  const probe = await columns.evaluateAll((nodes) => nodes.map((node) => ({ stage: node.getAttribute("data-desk-column"), count: Number(node.getAttribute("data-count")), top: Math.round(node.getBoundingClientRect().top), cards: node.querySelectorAll("[data-desk-card]").length })));
  // Catches: columns stacked or wrapped instead of one row.
  expect(new Set(probe.map((p) => p.top)).size).toBe(1);
  expect(probe.map((p) => p.stage)).toEqual(STAGES);
  // Catches: the data-count drifting from the cards shown, or the visitor's card missing from the total.
  for (const p of probe) expect(p.count).toBe(p.cards);
  expect(probe.reduce((sum, p) => sum + p.count, 0)).toBe(10);
  // Catches: the visitor's card missing, or out of place.
  const first = page.locator('[data-desk-column="requested"] [data-desk-card]').first();
  await expect(first).toHaveAttribute("data-mine", "true");
  await expect(first).toContainText(TEAM.yours);
  await expect(page.locator("[data-desk-card][data-mine]")).toHaveCount(1);
  const fit = await docFits(page);
  // Catches: a sideways page scroll (a weak backstop: #act-2 clips overflow, so the desk pins below carry the weight).
  expect(fit.wide).toBe(fit.width);
});

test("desk board: at 390 one column shows under a five-button stage strip", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await toDesk(page, true);
  // Catches: five squeezed columns on a phone.
  await expect(page.locator("[data-desk-column]:visible")).toHaveCount(1);
  await expect(strip(page)).toHaveCount(5);
  await expect(page.locator('[data-desk-column="requested"]')).toBeVisible();
  await strip(page).nth(3).click();
  await expect(page.locator('[data-desk-column="tracking"]')).toBeVisible();
  await expect(page.locator("[data-desk-column]:visible")).toHaveCount(1);
  // Catches: a stage pill under 44 by 44.
  for (const button of await strip(page).all()) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  const fit = await docFits(page);
  // Catches: a sideways page scroll (a weak backstop: #act-2 clips overflow).
  expect(fit.wide).toBe(fit.width);
});

for (const width of [320, 390]) {
  test(`desk board: at ${width} the desk scrolls inside itself and its lower half is reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await toDesk(page, true);
    const probe = await desk(page).evaluate((el) => ({ high: el.scrollHeight, shown: el.clientHeight, wide: el.scrollWidth, narrow: el.clientWidth }));
    // Catches: a desk too short to scroll, or content clipped away instead of scrolled.
    expect(probe.high).toBeGreaterThan(probe.shown);
    // Catches: sideways overflow inside the desk.
    expect(probe.wide).toBeLessThanOrEqual(probe.narrow);
    await desk(page).evaluate((el) => void (el.scrollTop = el.scrollHeight));
    // Catches: the lower desk (the full-version list) being unreachable.
    await expect(page.locator("[data-full-version] summary")).toBeInViewport();
    const fit = await docFits(page);
    // Catches: a sideways page scroll (a weak backstop).
    expect(fit.wide).toBe(fit.width);
  });

  test(`desk board: at ${width} every stage label is whole`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await toDesk(page, true);
    const cut = await strip(page).evaluateAll((pills) => pills.map((pill) => ({ pill: pill.scrollWidth > pill.clientWidth, label: [...pill.querySelectorAll("span")].some((span) => span.scrollWidth > span.clientWidth || getComputedStyle(span).textOverflow === "ellipsis") })));
    // Catches: clipped stage labels ("WITH FOUN...").
    expect(cut).toEqual(Array(5).fill({ pill: false, label: false }));
  });

  test(`desk board: at ${width} the selected pill stays in the strip`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await toDesk(page, true);
    const inside = () =>
      page.evaluate(() => {
        const box = document.querySelector("[data-stage-strip]")!.getBoundingClientRect();
        const pill = document.querySelector('[data-stage-strip] [aria-pressed="true"]')!.getBoundingClientRect();
        return pill.left >= box.left - 1 && pill.right <= box.right + 1;
      });
    // A programmatic click does not scroll the strip itself, so only the desk's own scroll-into-view can bring the pill in.
    await strip(page).nth(4).evaluate((el) => (el as HTMLElement).click());
    await expect(strip(page).nth(4)).toHaveAttribute("aria-pressed", "true");
    // Catches: the selected pill left out of view after the selection changes.
    expect(await inside()).toBe(true);
    await strip(page).nth(0).evaluate((el) => (el as HTMLElement).click());
    expect(await inside()).toBe(true);
  });
}

test("desk board: with no request spent the nudge shows, there is no Review, and Matches leads back to the candidate side", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toNetwork(page);
  await openTab(page, TAB.board);
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
  // Catches: the desk showing a request nobody made.
  await expect(page.locator("[data-desk-nudge]")).toBeVisible();
  await expect(page.locator("[data-desk-card][data-mine]")).toHaveCount(0);
  await expect(desk(page).getByRole("button", { name: TEAM.review, exact: true })).toHaveCount(0);
  await expect(page.locator("[data-narration]")).toHaveText(TEAM.beats.empty);
  await page.locator("[data-desk-nudge]").getByRole("button", { name: TEAM.nudgeButton }).click();
  // Catches: the nudge's button leaving the switch on Talent team (Review Focus 3).
  await expect(networkPhase(page)).toHaveAttribute("data-side", "candidate");
  await expect(candidateButton(page)).toHaveAttribute("aria-pressed", "true");
  // Catches: the button dropping its tab, so the flip lands on whichever tab was last open (the test starts on Board).
  await expect(page.getByRole("tab", { name: TAB.matches, exact: true })).toHaveAttribute("aria-selected", "true");
});

test("desk board: the narration is a polite status, the visitor's card carries Review, and the full version lists twelve steps", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toDesk(page, true);
  const narration = page.locator("[data-narration]");
  // Catches: a live region that is silent, or a narration that does not read the beat.
  await expect(narration).toHaveAttribute("role", "status");
  await expect(narration).toHaveAttribute("aria-live", "polite");
  await expect(narration).toHaveText(TEAM.beats.arrive);
  await expect(page.locator("[data-acting-as]")).toHaveText(TEAM.actingAs.team);
  const mine = page.locator("[data-desk-card][data-mine]");
  await expect(mine.getByRole("button", { name: TEAM.review, exact: true })).toBeVisible();
  await expect(page.locator("[data-learned]")).toContainText(TEAM.learnedHeading);
  await expect(page.locator("[data-learned] li")).toHaveCount(3);
  const full = page.locator("[data-full-version]");
  await full.locator("summary").click();
  // Catches: the loop visual dropped, or a step lost.
  await expect(full.locator("ol li")).toHaveCount(12);
  await expect(full.locator("ul li")).toHaveCount(6);
});

test("desk board: Two weeks later from the nudge adds the sample's line to the learned strip, and the desk survives a flip", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toDesk(page, false);
  await expect(page.locator("[data-learned] li")).toHaveCount(3);
  await page.locator("[data-desk-nudge]").getByRole("button", { name: TEAM.twoWeeks }).click();
  // Catches: the way out doing nothing, or the sample's tag line never joining the strip.
  await expect(page.locator("[data-learned] li")).toHaveCount(4);
  await expect(page.locator("[data-narration]")).toHaveText(TEAM.beats.twoWeeks);
  await candidateButton(page).click();
  await teamButton(page).click();
  // Catches: desk state lost on a switch flip.
  await expect(page.locator("[data-learned] li")).toHaveCount(4);
});
