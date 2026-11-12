import { speedrunCopy } from "../lib/content";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { LEARNED_FROM_SAMPLE, RIVALS } from "../lib/speedrun/deskSamples";
import { accountButton, networkPhase, openTab, skipBuildLog, skipToSam, spendIntro, startOver, tabKey } from "./speedrun-flow";

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

// ---- The walk (Rulings 74 to 78) ----

const BEATS = TEAM.beats;
const narration = (page: Page) => page.locator("[data-narration]");
const mineCard = (page: Page) => page.locator("[data-desk-card][data-mine]");
const mineIn = (page: Page, stage: string) => page.locator(`[data-desk-column="${stage}"] [data-desk-card][data-mine]`);
const compare = (page: Page) => page.locator('[data-desk-panel="compare"]');
const founderPanel = (page: Page) => page.locator("[data-founder-panel]");
const draft = (page: Page) => page.locator("[data-intro-draft]");
const mineCompany = (page: Page) => mineCard(page).locator("[data-card-company]").innerText();

/** Sam with her two intro-eligible matches brought forward (she has no third), the request on #1, on the talent team's desk. */
async function deskWithTwo(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toNetwork(page);
  await spendIntro(page, 2);
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
}

async function toFounderPanel(page: Page) {
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  await expect(compare(page)).toBeVisible();
  await compare(page).getByRole("button", { name: /^Send .* to the founder$/ }).click();
  await expect(founderPanel(page)).toBeVisible();
}

test("desk walk: Review, Send, Yes, the intro and two weeks later play the whole loop, one narration beat per step", async ({ page }) => {
  await deskWithTwo(page);
  await expect(narration(page)).toHaveText(BEATS.arrive);
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  // Catches: Review doing nothing, or a compare with no one to compare.
  await expect(compare(page)).toBeVisible();
  await expect(compare(page).locator('[data-compare-person="rival"]')).toHaveCount(2);
  await expect(compare(page).locator('[data-compare-person="mine"]')).toHaveCount(1);
  // Catches: a silent step.
  await expect(narration(page)).toHaveText(BEATS.review);
  const name = (await mineCard(page).locator("p").nth(1).innerText()).trim();
  await compare(page).getByRole("button", { name: TEAM.compare.send(name), exact: true }).click();
  await expect(founderPanel(page)).toBeVisible();
  // Catches: the view shift not said (the founder's page under the team's chip).
  await expect(founderPanel(page).locator("[data-acting-as]")).toHaveText(TEAM.actingAs.founder);
  await expect(founderPanel(page).getByRole("heading", { level: 2 })).toBeFocused();
  await expect(narration(page)).toHaveText(BEATS.sent);
  await expect(mineIn(page, "withFounder")).toHaveCount(1);
  await expect(founderPanel(page).locator("[data-one-pager]")).toBeVisible();
  await founderPanel(page).getByRole("button", { name: TEAM.founder.yes, exact: true }).click();
  await expect(founderPanel(page)).toHaveCount(0);
  // Catches: the card staying in With founder after a Yes.
  await expect(mineIn(page, "connected")).toHaveCount(1);
  await expect(draft(page)).toBeVisible();
  await expect(narration(page)).toHaveText(BEATS.interested);
  await page.locator("[data-intro-draft]").getByRole("button", { name: TEAM.introDraft.send, exact: true }).click();
  await expect(narration(page)).toHaveText(BEATS.introSent);
  await expect(draft(page)).toContainText(TEAM.introDraft.sent);
  await expect(page.locator("[data-finished-sample]")).toHaveCount(0);
  await page.locator("[data-desk-panel]").getByRole("button", { name: TEAM.twoWeeks, exact: true }).click();
  // Catches: the finished sample never reached, or reached without its survey.
  await expect(page.locator("[data-finished-sample]")).toBeVisible();
  await expect(page.locator("[data-finished-sample]")).toContainText(TEAM.sample.surveyQuestion);
  await expect(page.locator("[data-finished-sample]")).toContainText(TEAM.sample.fitHit);
  await expect(page.locator("[data-finished-sample]")).toContainText(TEAM.sample.end);
  // Catches: the learned line hidden under the drawer (the strip behind it is covered at 1440).
  await expect(page.locator("[data-finished-sample] [data-sample-learned]")).toContainText(LEARNED_FROM_SAMPLE);
  await expect(narration(page)).toHaveText(BEATS.twoWeeks);
  await expect(page.locator("[data-learned] li")).toHaveCount(4);
});

test("desk walk: Not now passes the request, and the candidate's next match goes live on both sides", async ({ page }) => {
  await deskWithTwo(page);
  const first = await mineCompany(page);
  await toFounderPanel(page);
  await founderPanel(page).getByRole("button", { name: TEAM.founder.notNow, exact: true }).click();
  await expect(founderPanel(page)).toHaveCount(0);
  await expect(narration(page)).toContainText("frees Sam's pick");
  // Catches: the next match never going live, or the old card staying.
  await expect(mineIn(page, "requested")).toHaveCount(1);
  const second = await mineCompany(page);
  expect(second).not.toBe(first);
  await expect(mineIn(page, "withFounder")).toHaveCount(0);
  await candidateButton(page).click();
  const row = page.locator("[data-match-row]").filter({ hasText: second }).first();
  await row.click();
  // Catches: the desk and the candidate's shortlist out of sync (the request not moved to #2, or still at the passed match).
  await expect(page.locator("[data-match-detail] [data-intro-here]")).toBeVisible();
  await expect(page.locator("[data-match-detail] [data-shortlist-rank]")).toHaveText("#1");
});

test("desk walk: Send instead sends the rival on, and the rival never becomes a card at a real company", async ({ page }) => {
  await deskWithTwo(page);
  const first = await mineCompany(page);
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  const rivalNames = await compare(page).locator('[data-compare-person="rival"] [data-compare-name]').allInnerTexts();
  expect(rivalNames).toHaveLength(2);
  await compare(page).getByRole("button", { name: TEAM.compare.sendInstead, exact: true }).first().click();
  await expect(compare(page)).toHaveCount(0);
  await expect(founderPanel(page)).toHaveCount(0);
  await expect(narration(page)).toContainText(`${rivalNames[0].trim()}'s one-pager goes to the founder instead`);
  // Catches: the visitor's card moving on, or the old match staying live.
  await expect(mineIn(page, "requested")).toHaveCount(1);
  expect(await mineCompany(page)).not.toBe(first);
  // Catches: a rival at a real company moving on as a card (Ruling 2).
  const everyRival = RIVALS.engineering.concat(RIVALS.ai, RIVALS.product, RIVALS.design, RIVALS.operations, RIVALS.default).map((r) => r.firstName);
  const founderColumn = await page.locator('[data-desk-column="withFounder"]').innerText();
  for (const rival of everyRival) expect(founderColumn).not.toContain(rival);
  await expect(page.locator('[data-desk-column="withFounder"] [data-desk-card]')).toHaveCount(2);
});

test("desk walk: with one match brought forward, Not now leaves the nudge and Two weeks later still works", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toNetwork(page);
  await spendIntro(page, 1);
  await teamButton(page).click();
  await toFounderPanel(page);
  await founderPanel(page).getByRole("button", { name: TEAM.founder.notNow, exact: true }).click();
  // Catches: a pass with nowhere to go leaving a ghost card, or no way forward.
  await expect(mineCard(page)).toHaveCount(0);
  await expect(page.locator("[data-desk-nudge]")).toBeVisible();
  await expect(narration(page)).toHaveText(BEATS.notNow("Sam"));
  await page.locator("[data-desk-nudge]").getByRole("button", { name: TEAM.twoWeeks, exact: true }).click();
  await expect(page.locator("[data-finished-sample]")).toBeVisible();
});

test("desk walk: a candidate-side swap while the drawer is open shows the new match", async ({ page }) => {
  await deskWithTwo(page);
  const first = await mineCompany(page);
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  await expect(compare(page)).toContainText(first);
  await candidateButton(page).click();
  const rows = page.locator("[data-match-row]");
  const rank = page.locator("[data-match-detail] [data-shortlist-rank]");
  const total = await rows.count();
  for (let i = 0; i < total; i++) {
    await rows.nth(i).click();
    if ((await rank.count()) > 0 && (await rank.innerText()) === "#2") break;
  }
  await expect(rank).toHaveText("#2");
  await page.locator("[data-swap-intro]").click();
  await teamButton(page).click();
  const second = await mineCompany(page);
  expect(second).not.toBe(first);
  // Catches: the drawer copying the request when it opened, so it keeps showing the old match.
  await expect(compare(page)).toBeVisible();
  await expect(compare(page)).toContainText(second);
  await expect(compare(page)).not.toContainText(first);
});

test("desk walk: the founder panel traps focus, Escape closes it onto the visitor's card, and the one-pager reopens", async ({ page, browserName }) => {
  await deskWithTwo(page);
  await toFounderPanel(page);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(tabKey(browserName));
    // Catches: Tab leaving the panel for the dimmed desk behind it.
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-founder-panel]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(founderPanel(page)).toHaveCount(0);
  // Catches: Escape sending the card back, or closing onto nothing.
  await expect(mineIn(page, "withFounder")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[data-desk-card][data-mine]"))).toBe(true);
  await mineCard(page).getByRole("button", { name: TEAM.openFounder, exact: true }).click();
  await expect(founderPanel(page)).toBeVisible();
});

test("desk walk: the compare drawer takes focus on its heading and Escape closes it onto the visitor's card", async ({ page }) => {
  await deskWithTwo(page);
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  // Catches: focus left on the Review button behind the drawer.
  await expect(compare(page).getByRole("heading", { level: 3 })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(compare(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[data-desk-card][data-mine]"))).toBe(true);
  await expect(mineIn(page, "requested")).toHaveCount(1);
});

test("desk walk: a rebuild mid-walk leaves a fresh desk, with no panel and the arrive line", async ({ page }) => {
  await deskWithTwo(page);
  await toFounderPanel(page);
  await founderPanel(page).getByRole("button", { name: TEAM.founder.yes, exact: true }).click();
  await expect(mineIn(page, "connected")).toHaveCount(1);
  await draft(page).getByRole("button", { name: TEAM.introDraft.send, exact: true }).click();
  await page.locator("[data-desk-panel]").getByRole("button", { name: TEAM.twoWeeks, exact: true }).click();
  await expect(page.locator("[data-learned] li")).toHaveCount(4);
  await startOver(page);
  await expect(page.locator('#act-2[data-phase="join"]')).toBeVisible({ timeout: 8000 });
  await skipToSam(page);
  await skipBuildLog(page);
  await spendIntro(page, 2);
  await teamButton(page).click();
  // Catches: desk state surviving a rebuild (a stale panel, a stale beat, a card still in Connected).
  await expect(mineIn(page, "requested")).toHaveCount(1);
  await expect(narration(page)).toHaveText(BEATS.arrive);
  await expect(page.locator("[data-desk-panel]")).toHaveCount(0);
  await expect(founderPanel(page)).toHaveCount(0);
  // Catches: the old walk's sample line still on the learned strip.
  await expect(page.locator("[data-learned] li")).toHaveCount(3);
});

test("desk walk: taking the request off the shortlist while the drawer is open closes it, and the desk reads as the empty queue", async ({ page }) => {
  await deskWithTwo(page);
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  await expect(compare(page)).toBeVisible();
  await candidateButton(page).click();
  const rows = page.locator("[data-match-row]");
  const rank = page.locator("[data-match-detail] [data-shortlist-rank]");
  const total = await rows.count();
  for (let i = 0; i < total; i++) {
    await rows.nth(i).click();
    if ((await rank.count()) > 0 && (await rank.innerText()) === "#1") break;
  }
  await expect(rank).toHaveText("#1");
  await page.locator("[data-match-detail] [data-bring-forward]").click();
  await teamButton(page).click();
  // Catches: a drawer left open on a request that no longer exists.
  await expect(page.locator("[data-desk-panel]")).toHaveCount(0);
  await expect(mineCard(page)).toHaveCount(0);
  // Catches: the narration still saying the team is comparing.
  await expect(narration(page)).toHaveText(BEATS.empty);
  // A new request must arrive on a clean desk: the closed drawer may not come back with it.
  await candidateButton(page).click();
  for (let i = 0; i < total; i++) {
    await rows.nth(i).click();
    if ((await rank.count()) > 0 && (await rank.innerText()) === "#1") break;
  }
  await page.locator("[data-match-detail] [data-request-intro]").click();
  await teamButton(page).click();
  await expect(mineIn(page, "requested")).toHaveCount(1);
  // Catches: a stale drawer, or a stale review line, reappearing on the next request.
  await expect(page.locator("[data-desk-panel]")).toHaveCount(0);
  await expect(narration(page)).toHaveText(BEATS.arrive);
});

test("desk walk: removing the request and re-requesting without visiting the team side leaves no stale drawer", async ({ page }) => {
  await deskWithTwo(page);
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  await expect(compare(page)).toBeVisible();
  await candidateButton(page).click();
  const rows = page.locator("[data-match-row]");
  const rank = page.locator("[data-match-detail] [data-shortlist-rank]");
  const total = await rows.count();
  const pickRank = async (wanted: string) => {
    for (let i = 0; i < total; i++) {
      await rows.nth(i).click();
      if ((await rank.count()) > 0 && (await rank.innerText()) === wanted) return;
    }
  };
  await pickRank("#1");
  await page.locator("[data-match-detail] [data-bring-forward]").click();
  await pickRank("#1");
  await page.locator("[data-match-detail] [data-request-intro]").click();
  await teamButton(page).click();
  await expect(mineIn(page, "requested")).toHaveCount(1);
  // Catches: the drawer, closed only when the team side was mounted, reopening over the new arrival.
  await expect(page.locator("[data-desk-panel]")).toHaveCount(0);
  await expect(narration(page)).toHaveText(BEATS.arrive);
});

test("desk walk: at 390 every panel carries the narration line and the phone walk reaches the finished sample", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await toNetwork(page);
  await spendIntro(page, 2);
  await teamButton(page).click();
  await expect(desk(page)).toBeVisible();
  await mineCard(page).getByRole("button", { name: TEAM.review, exact: true }).click();
  const panelLine = page.locator("[data-desk-panel] [data-panel-narration]");
  // Catches: the drawer covering the narration with nothing in its place.
  await expect(panelLine).toHaveText(BEATS.review);
  await expect(panelLine).toBeInViewport();
  await compare(page).getByRole("button", { name: /^Send .* to the founder$/ }).click();
  // Catches: the founder's modal dimming the value statement at the moment it matters (Aaron's line, verbatim).
  await expect(founderPanel(page).locator("[data-panel-narration]")).toHaveText("Splits then puts together a one-page profile so the founder can see the candidate's experience.");
  await founderPanel(page).getByRole("button", { name: TEAM.founder.yes, exact: true }).click();
  await expect(panelLine).toHaveText(BEATS.interested);
  await draft(page).getByRole("button", { name: TEAM.introDraft.send, exact: true }).click();
  const twoWeeks = page.locator("[data-desk-panel]").getByRole("button", { name: TEAM.twoWeeks, exact: true });
  // Catches: a phone walk that dead-ends because Two weeks later sits on the card under the drawer.
  await expect(twoWeeks).toBeInViewport();
  await twoWeeks.click();
  await expect(page.locator("[data-finished-sample]")).toBeVisible();
  await expect(page.locator("[data-desk-panel] [data-panel-narration]")).toHaveText(BEATS.twoWeeks);
});
