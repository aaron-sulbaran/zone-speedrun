import type { Page } from "@playwright/test";
import { siteContent, speedrunCopy } from "../lib/content";
import { test, expect } from "./support/fixtures";
import { AARON_ENTRIES } from "../lib/speedrun/aaronMock";
import { accountButton, accountPanel, answerOnboarding, expectVisitorName, joinPhase, networkHeading, networkPhase, openAccountMenu, openTab, playSwitch, replayFromTop, settleHero, skipBuildLog, skipToSam, startOver } from "./speedrun-flow";

// The site's MVP link label (quickCopy.titleShort on the site), kept literal here.
const QUICK_TITLE_SHORT = "MVP";

const network = speedrunCopy.network;
const join = speedrunCopy.join;
const switchButton = (page: Page) => page.getByRole("button", { name: speedrunCopy.act1.closing.button });
const counter = (page: Page) => page.locator("#join").getByText(/^\d\d \/ \d\d$/);

async function reachNetwork(page: Page, name = "Alex") {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name });
  await skipBuildLog(page);
}

test("renders logged out with noindex, then the join card carries the affiliation line and logo", async ({ page }) => {
  const response = await page.goto("/speedrun");
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(speedrunCopy.meta.title);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/);
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);
  await expect(robots).toHaveAttribute("content", /nofollow/);

  await playSwitch(page);
  await expect(page.getByText(speedrunCopy.affiliation).first()).toBeVisible();
  const logo = page.getByRole("img", { name: speedrunCopy.logoAlt }).first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // The zone has no Menu pill: the site's logo is the way back, a plain link to the site root
  // (next/link would prefix the basePath and soft-navigate inside the zone).
  const home = page.getByRole("link", { name: siteContent.logoAriaLabel });
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/");
});

test("the hero shows first, with no phase of the styled section in the DOM", async ({ page }) => {
  await page.goto("/speedrun");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(speedrunCopy.act1.headline1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(speedrunCopy.act1.headline2);
  await expect(page.locator("section[data-hero]")).toBeVisible();
  await expect(page.locator("[data-hero-count]")).toHaveText(String(AARON_ENTRIES.length));
  expect(await page.locator("[data-hero] svg path.flow-link").count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator("#act-2")).toHaveCount(0);
  await expect(page.locator("[data-phase]")).toHaveCount(0);
  await expect(page.locator("#join")).toHaveCount(0);
});

const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");

// Catches: hero words rendered client-only (a motion wrapper that mounts after hydration).
test("every word of the hero is in the server HTML", async ({ request }) => {
  const html = textOf(await (await request.get("/speedrun")).text());
  const copy = speedrunCopy.act1;
  for (const text of [copy.flowTitle, copy.privacyNote, copy.headline1, copy.headline2, copy.subtitle.count(AARON_ENTRIES.length), copy.p1, copy.p2, copy.closing.line, copy.closing.sub, copy.closing.button]) {
    expect(html).toContain(text);
  }
});

// Catches: a hero taller than the screen, which would push the closing button below the fold (1440 by 790 and 1366 by 768 are real laptop windows).
for (const [width, height] of [[1440, 900], [1440, 790], [1366, 768], [1280, 800]] as const) {
  test(`the hero fits one screen at ${width} by ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/speedrun");
    await settleHero(page);
    const fit = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      inner: window.innerHeight,
      buttonBottom: document.querySelector("[data-hero-start]")!.getBoundingClientRect().bottom,
    }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.inner);
    expect(fit.buttonBottom).toBeLessThanOrEqual(fit.inner);
  });
}

// Catches: an undocked button that sits below the fold on a phone.
for (const [width, height] of [[390, 844], [375, 667]] as const) {
  test(`on a phone the button is docked and fully visible on load at ${width} by ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/speedrun");
    await settleHero(page);
    const dock = await page.evaluate(() => {
      const button = document.querySelector("[data-hero-start]")!;
      const rect = button.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, inner: window.innerHeight, position: getComputedStyle(button.closest("[data-intro-el='close']")!).position };
    });
    expect(dock.top).toBeGreaterThanOrEqual(0);
    expect(dock.bottom).toBeLessThanOrEqual(dock.inner);
    expect(dock.position).toBe("fixed");
  });
}

// Catches: the hero overflowing sideways at a breakpoint (a wide chart or an unwrapped word).
for (const width of [375, 390, 768, 1280, 1440]) {
  test(`no horizontal scroll on the hero at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/speedrun");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

// Catches: the chart's applied value and the subtitle's number coming from different sources.
test("the chart's applied value matches the subtitle", async ({ page }) => {
  await page.goto("/speedrun");
  const subtitle = (await page.locator("[data-hero-count]").textContent())!.trim();
  const chart = page.locator("[data-flow-source-value]").filter({ visible: true });
  await expect(chart).toHaveCount(1);
  expect((await chart.textContent())!.trim()).toBe(subtitle);
});

test("with motion the same click starts the sweep on the strip", async ({ page }) => {
  await page.goto("/speedrun");
  await settleHero(page);
  // The hero's button bumps a signal and the sweep starts in the effect after it, so poll for the strip's animations.
  await switchButton(page).click();
  await page.waitForFunction(() => {
    const strip = document.querySelector<HTMLElement>("[data-shift-strip]")!;
    return strip.getAnimations().length >= 1 && getComputedStyle(strip).visibility === "visible";
  }, undefined, { timeout: 2000 });
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
});

test("the switch lands on the join card at the top of the page with the name input focused", async ({ page }) => {
  // A short window, so the hero scrolls and "back at the top" is a real claim.
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/speedrun");
  await settleHero(page);
  await switchButton(page).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await switchButton(page).click();
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('section[data-act="1"]')).toHaveCount(0);
  await expect(page.locator("[data-shift-strip]")).toBeHidden({ timeout: 8000 });
});

test("a double click on the switch sweeps once and lands on the join card once", async ({ page }) => {
  // The strip is animated twice per sweep (cover, reveal); a second, unguarded sweep would make it four.
  await page.addInitScript(() => {
    const w = window as unknown as { __stripAnimations: number };
    w.__stripAnimations = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      if (this.matches("[data-shift-strip]")) w.__stripAnimations += 1;
      return original.apply(this, args);
    };
  });
  await page.goto("/speedrun");
  await settleHero(page);
  await switchButton(page).dblclick();
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
  await expect(page.locator("[data-shift-strip]")).toBeHidden({ timeout: 8000 });
  expect(await page.evaluate(() => (window as unknown as { __stripAnimations: number }).__stripAnimations)).toBe(2);
  await expect(page.locator('[data-phase="join"]')).toHaveCount(1);
  await expect(page.locator("#join")).toHaveCount(1);
  await expect(counter(page)).toHaveText("01 / 07");
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
});

test("the student branch counts 03 / 07 before the answer and 04 / 08 after it, then builds the network", async ({ page }) => {
  await page.goto("/speedrun");
  const seen: Record<string, string> = {};
  await answerOnboarding(page, {
    name: "Alex",
    student: true,
    arrangements: ["between", "afterGrad"],
    onStep: async (step) => {
      if (step === "student" || step === "arrangements") seen[step] = (await counter(page).textContent()) ?? "";
    },
  });
  expect(seen).toEqual({ student: "03 / 07", arrangements: "04 / 08" });
  await expect(page.locator("#act-2 [data-phase-heading]")).toHaveText(speedrunCopy.build.heading("Alex"));
  await skipBuildLog(page);
  await expect(networkHeading(page)).toHaveText(speedrunCopy.matches.listHeading("Alex"));
  await expectVisitorName(page, "Alex");
});

test("tapping Yes then No within the advance beat moves on once, on No", async ({ page }) => {
  await playSwitch(page);
  await page.locator("#join").getByLabel(join.steps.name.inputLabel).fill("Alex");
  await page.locator("#join").getByRole("button", { name: join.next }).click();
  await page.locator("#join").getByRole("button", { name: join.targetLabels.product, exact: true }).click();
  await page.locator("#join").getByRole("button", { name: join.next }).click();
  await expect(page.locator("#join").getByRole("heading", { name: join.steps.student.question })).toBeVisible();
  const clicked = await page.evaluate(
    ([yes, no]) => {
      const radios = [...document.querySelectorAll<HTMLElement>('#join [role="radio"]')];
      const picks = [radios.find((radio) => radio.textContent === yes), radios.find((radio) => radio.textContent === no)];
      picks.forEach((radio) => radio?.click());
      return picks.filter(Boolean).length;
    },
    [join.yes, join.no],
  );
  expect(clicked).toBe(2);
  const places = page.locator("#join").getByRole("heading", { name: join.steps.places.question });
  await expect(places).toBeVisible();
  // One advance, and on No: the arrangements step never appeared and the card stayed put.
  await page.waitForTimeout(700);
  await expect(places).toBeVisible();
  await expect(page.locator("#join").getByRole("heading", { name: join.steps.arrangements.question })).toHaveCount(0);
  await expect(counter(page)).toHaveText("04 / 07");
});

test("the four tabs switch with the arrow keys, Home and End, and a panel mounts on first selection", async ({ page }) => {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  const tabs = page.getByRole("tablist", { name: network.tabsLabel });
  await expect(tabs.getByRole("tab")).toHaveText([network.tabs.matches, network.tabs.board, network.tabs.brief, network.tabs.decisions]);
  const selected = (label: string) => expect(tabs.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-board]")).toHaveCount(0);
  await tabs.getByRole("tab", { name: network.tabs.matches, exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await selected(network.tabs.board);
  await expect(tabs.getByRole("tab", { name: network.tabs.board, exact: true })).toBeFocused();
  await expect(page.locator("[data-board]")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await selected(network.tabs.brief);
  await page.keyboard.press("ArrowRight");
  await selected(network.tabs.decisions);
  await page.keyboard.press("ArrowRight");
  await selected(network.tabs.matches);
  await page.keyboard.press("ArrowLeft");
  await selected(network.tabs.decisions);
  await page.keyboard.press("Home");
  await selected(network.tabs.matches);
  await page.keyboard.press("End");
  await selected(network.tabs.decisions);
  await expect(page.getByRole("tabpanel").filter({ visible: true })).toHaveCount(1);
  // Next buttons carry on to the following tab and move focus onto it.
  await openTab(page, network.tabs.matches);
  await page.getByRole("button", { name: network.nextTo.matches }).click();
  await selected(network.tabs.board);
  await expect(tabs.getByRole("tab", { name: network.tabs.board, exact: true })).toBeFocused();
});

test("Start over returns to step 1 with an empty name, and Replay from the top returns to the opener", async ({ page }) => {
  await reachNetwork(page, "Alex");
  await startOver(page);
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toHaveValue("");
  await expect(counter(page)).toHaveText("01 / 07");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await answerOnboarding(page, { name: "Blake" });
  await skipBuildLog(page);
  await expect(networkHeading(page)).toHaveText(speedrunCopy.matches.listHeading("Blake"));
  await expectVisitorName(page, "Blake");
  await replayFromTop(page);
  await expect(page.locator('section[data-act="1"]')).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#act-2")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The opener is armed again: the switch plays and the join card starts clean.
  await playSwitch(page);
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toHaveValue("");
  await expect(counter(page)).toHaveText("01 / 07");
});

// Regression: the join footer was sticky on phones and covered a fifth of the people step,
// with the sample cards showing through its fill (Ruling 18). Below md it sits in flow.
test("at 375 the join footer sits in flow below the last sample card", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Casey", stopAtResume: true });
  const result = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>("[data-join-footer]")!;
    const cards = document.querySelectorAll<HTMLElement>("[data-person]");
    return { position: getComputedStyle(footer).position, footerTop: footer.getBoundingClientRect().top, lastCardBottom: cards[cards.length - 1].getBoundingClientRect().bottom };
  });
  expect(result.position).not.toBe("sticky");
  expect(result.footerTop).toBeGreaterThanOrEqual(result.lastCardBottom);
});

// Regression: with the footer in flow it can sit below the fold, so a pick must bring the
// primary button into view or the visitor never finds Continue.
test("at 375 picking a sample person scrolls the footer button fully into view", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Casey", stopAtResume: true });
  await page.locator('#join [data-person]').first().click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const rect = document.querySelector<HTMLElement>("[data-join-footer] button:last-of-type")!.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        }),
      { timeout: 3000 },
    )
    .toBe(true);
});

// Regression: the in-flow footer must not leak to desktop, where the sticky bar stays.
test("at 1440 the join footer is still sticky", async ({ page }) => {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Casey", stopAtResume: true });
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("[data-join-footer]")!).position)).toBe("sticky");
});

test("Start over during the building beat cancels the build: clean step 1 and no match request", async ({ page }) => {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Casey", stopAtResume: true });
  const form = page.locator("#join");
  await form.locator('[data-person="sam"]').click();
  await form.getByRole("button", { name: join.finish }).click();
  await expect(form.getByRole("status")).toHaveText(speedrunCopy.build.heading("Casey"));
  await form.getByRole("button", { name: join.startOver }).click();
  await expect(counter(page)).toHaveText("01 / 07");
  await expect(form.getByLabel(join.steps.name.inputLabel)).toHaveValue("");
  // Wait out the 700ms beat: a beat that was not cancelled would fire the request now.
  await expect(page.waitForRequest("**/speedrun/api/match", { timeout: 1500 })).rejects.toThrow();
  await expect(page.locator('[data-phase="join"]')).toHaveCount(1);
  await expect(page.locator('[data-phase="building"], [data-phase="network"]')).toHaveCount(0);
  await expect(page.locator("#act-2 [data-demo]")).toHaveAttribute("data-step", "join");
  await expect(counter(page)).toHaveText("01 / 07");
});

test("Start over with a match request in flight lands on a clean step 1 and the stale result never appears", async ({ page }) => {
  // Press Start over from inside the page at the moment the match fetch starts, while the join frame is still in its exit.
  await page.addInitScript((startOverLabel) => {
    const realFetch = window.fetch;
    window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>) {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      if (url.includes("/speedrun/api/match")) {
        const start = [...document.querySelectorAll<HTMLButtonElement>("#join button")].find((b) => b.textContent === startOverLabel);
        start?.click();
        (window as unknown as { __startOverPressed: boolean }).__startOverPressed = Boolean(start);
      }
      return realFetch.apply(this, args);
    };
  }, join.startOver);
  await page.route("**/speedrun/api/match", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });
  const failed: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().includes("/speedrun/api/match")) failed.push(request.url());
  });
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Casey", stopAtResume: true });
  const form = page.locator("#join");
  await form.locator('[data-person="sam"]').click();
  await form.getByRole("button", { name: join.finish }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __startOverPressed?: boolean }).__startOverPressed), { timeout: 8000 }).toBe(true);
  await expect(page.locator('#act-2[data-phase="join"]')).toBeVisible({ timeout: 5000 });
  await expect(counter(page)).toHaveText("01 / 07");
  await expect(form.getByLabel(join.steps.name.inputLabel)).toHaveValue("");
  // The reset aborts the fetch, so the old response has nowhere to land.
  await expect.poll(() => failed.length, { timeout: 5000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1800);
  await expect(page.locator('[data-phase="join"]')).toHaveCount(1);
  await expect(page.locator("[data-match-card]")).toHaveCount(0);
  await expect(page.locator('[data-phase="building"], [data-phase="network"]')).toHaveCount(0);
  await expect(page.locator("#act-2 [data-demo]")).toHaveAttribute("data-step", "join");
  await expect(counter(page)).toHaveText("01 / 07");
});

test("the whole flow works by keyboard alone", async ({ page }) => {
  await page.goto("/speedrun");
  await settleHero(page);
  await switchButton(page).focus();
  await page.keyboard.press("Enter");
  const card = page.locator("#join");
  const heading = (question: string) => card.getByRole("heading", { name: question });
  await expect(card.getByLabel(join.steps.name.inputLabel)).toBeFocused({ timeout: 8000 });
  await page.keyboard.type("Dana");
  await page.keyboard.press("Enter");
  await expect(heading(join.steps.targets.question)).toBeVisible();
  await expect(card.getByRole("button", { name: join.targetLabels.engineering })).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(heading(join.steps.student.question)).toBeVisible();
  await expect(card.getByRole("radio", { name: join.yes, exact: true })).toBeFocused();
  // Roving tabindex: Yes is the only tab stop, and the arrow moves and selects (the card then advances once).
  await expect(card.getByRole("radio", { name: join.no, exact: true })).toHaveAttribute("tabindex", "-1");
  // Landing on No (not Yes, which would open the arrangements step) proves the arrow moved the focus and selected.
  await page.keyboard.press("ArrowRight");
  await expect(heading(join.steps.places.question)).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(heading(join.steps.founding.question)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(heading(join.steps.why.question)).toBeVisible();
  await expect(card.getByLabel(join.steps.why.inputLabel)).toBeFocused();
  await page.keyboard.type("Build things.");
  await page.keyboard.press("Enter");
  await expect(heading(join.steps.resume.question)).toBeVisible();
  await expect(card.getByText(/^Step 7 of 7\./)).toBeAttached();
  await expect(card.getByText(join.nothingSent)).toBeVisible();
  await expect(card.locator('[data-affiliation="inline"]')).toBeVisible();
  await expect(card.locator('[data-person="maya"]')).toBeFocused();
  // Nothing is picked yet, so the first arrow press picks the first person.
  await page.keyboard.press("ArrowRight");
  await expect(card.locator('[data-person="maya"]')).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-phase="building"]')).toBeVisible({ timeout: 8000 });
  await expect(networkPhase(page).or(page.locator("[data-build-log]"))).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-phase="building"] [data-phase-heading]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-build-log]").getByRole("button", { name: speedrunCopy.build.skip })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(networkHeading(page)).toBeFocused({ timeout: 10_000 });
  await expect(networkHeading(page)).toHaveText(speedrunCopy.matches.listHeading("Dana"));
  // Open the account menu by keyboard too: focus the button, Enter opens it, Escape closes it.
  await accountButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(accountButton(page)).toHaveAttribute("aria-expanded", "true");
  await expect(accountPanel(page)).toContainText("Dana");
  await page.keyboard.press("Escape");
  await expect(accountPanel(page)).toBeHidden();
  await expect(accountButton(page)).toBeFocused();
});

test("the typed name never leaves the page", async ({ page }) => {
  const name = "Zephyrine";
  const bodies: string[] = [];
  const urls: string[] = [];
  page.on("request", (request) => {
    urls.push(request.url());
    const body = request.postData();
    if (body) bodies.push(body);
  });
  await page.goto("/speedrun");
  await answerOnboarding(page, { name, why: "Build with a founding team.", places: ["Remote"], connectGmail: true });
  await skipBuildLog(page);
  await expect(networkHeading(page)).toHaveText(speedrunCopy.matches.listHeading(name));
  await expectVisitorName(page, name);
  await openTab(page, network.tabs.board);
  await openTab(page, network.tabs.brief);
  await expect(page.locator("[data-brief-subject]")).toContainText(name);
  await openTab(page, network.tabs.decisions);
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) expect(body.toLowerCase()).not.toContain(name.toLowerCase());
  for (const url of urls) expect(url.toLowerCase()).not.toContain(name.toLowerCase());
  expect(new URL(page.url()).pathname).toBe("/speedrun");
  expect(page.url()).not.toContain(name);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the switch completes with no sweep", async ({ page }) => {
    // Catches: the reduced-motion path starting the strip's sweep. The sweep starts after the click (a signal and an effect), so count every animate() call on the strip for the whole switch.
    await page.addInitScript(() => {
      const w = window as unknown as { __stripAnimations: number };
      w.__stripAnimations = 0;
      const original = Element.prototype.animate;
      Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
        if (this.matches("[data-shift-strip]")) w.__stripAnimations += 1;
        return original.apply(this, args);
      };
    });
    await page.goto("/speedrun");
    await settleHero(page);
    await page.getByRole("button", { name: speedrunCopy.act1.closing.button }).click();
    await expect(joinPhase(page)).toBeVisible({ timeout: 4000 });
    await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __stripAnimations: number }).__stripAnimations)).toBe(0);
    await expect(page.locator("[data-shift-strip]")).toBeHidden();
  });

  test("the skip path lands on the network with no Continue press", async ({ page }) => {
    await page.goto("/speedrun");
    await playSwitch(page);
    await page.getByRole("button", { name: speedrunCopy.hero.ctaSecondary }).first().click();
    await expect(networkPhase(page)).toBeVisible({ timeout: 10_000 });
    await expect(networkHeading(page)).toBeFocused();
    await expect(networkHeading(page)).toHaveText(speedrunCopy.matches.listHeading("Sam"));
    await expectVisitorName(page, "Sam");
    await expect(page.getByRole("button", { name: speedrunCopy.build.continue })).toHaveCount(0);
  });

  test("an answered run shows the finished log with Continue, and Continue lands on the network", async ({ page }) => {
    await page.goto("/speedrun");
    await answerOnboarding(page, { name: "Alex" });
    const log = page.locator("[data-build-log]");
    await expect(log).toBeVisible({ timeout: 10_000 });
    await expect(log).toHaveAttribute("aria-label", speedrunCopy.build.labelDone);
    await expect(log.getByRole("button", { name: speedrunCopy.build.skip })).toHaveCount(0);
    const proceed = page.getByRole("button", { name: speedrunCopy.build.continue });
    await expect(proceed).toBeVisible();
    await expect(networkPhase(page)).toHaveCount(0);
    await proceed.click();
    await expect(networkPhase(page)).toBeVisible({ timeout: 5000 });
    await expect(networkHeading(page)).toHaveText(speedrunCopy.matches.listHeading("Alex"));
    await expectVisitorName(page, "Alex");
  });
});

test.describe("short viewport", () => {
  test.use({ viewport: { width: 1440, height: 400 } });
  test("the switch lands at the top and Replay from the top re-arms it", async ({ page }) => {
    await page.goto("/speedrun");
    await settleHero(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await switchButton(page).scrollIntoViewIfNeeded();
    await switchButton(page).click();
    await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByRole("button", { name: speedrunCopy.hero.ctaSecondary }).first().click();
    await skipBuildLog(page);
    await replayFromTop(page);
    await expect(page.locator('section[data-act="1"]')).toBeVisible({ timeout: 8000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(switchButton(page)).toBeEnabled();
  });
});

for (const key of ["maya", "ravi", "sam", "lena", "dev"] as const) {
  test(`no horizontal scroll at 390 after picking ${key}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/speedrun");
    await playSwitch(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await answerOnboarding(page, { person: key, connectGmail: true, student: true, arrangements: ["between"] });
    await skipBuildLog(page);
    for (const label of Object.values(network.tabs)) {
      await openTab(page, label);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), label).toBeLessThanOrEqual(390);
      await expectScrollersFit(page, label);
    }
    await page.locator("[data-close]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expectScrollersFit(page, "close");
  });
}

test("the Why tab holds the decisions, then the close card with the affiliation line", async ({ page }) => {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  await openTab(page, network.tabs.decisions);
  const section = page.locator("[data-decisions]");
  await expect(section.getByRole("heading", { name: speedrunCopy.decisions.heading })).toBeVisible();
  await expect(section.locator("[data-decision-card]")).toHaveCount(6);
  const close = page.locator("[data-close]");
  await expect(close.getByRole("heading", { name: speedrunCopy.close.eyebrow })).toBeAttached();
  await expect(close.getByText(speedrunCopy.affiliation)).toBeAttached();
  const linkedin = siteContent.menu.socials.find((social) => social.key === "linkedin")?.href;
  const links = page.locator("[data-close] a");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveAttribute("href", "/");
  await expect(links.nth(1)).toHaveAttribute("href", "/quick");
  await expect(links.nth(1)).toHaveText(QUICK_TITLE_SHORT);
  await expect(links.nth(2)).toHaveAttribute("href", linkedin ?? "");
  await expect(links.nth(2)).toHaveAttribute("target", "_blank");
  await expect(links.nth(2)).toHaveAttribute("rel", "noopener noreferrer");
  // The close card comes after the decisions inside the same panel.
  const order = await page.evaluate(() => {
    const decisions = document.querySelector("[data-decisions]")!;
    const close = document.querySelector("[data-close]")!;
    return { sameParent: decisions.parentElement === close.parentElement, after: !!(decisions.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  expect(order).toEqual({ sameParent: true, after: true });
});

const TABS = Object.values(network.tabs);
/** Wide panel content scrolls sideways inside its panel (overflow-y:auto makes overflow-x auto) and never reaches the document's scrollWidth, so read the scrollers too. */
const scrollerFits = (page: Page) =>
  page.evaluate(() => {
    const read = (el: Element | null) => (el ? { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : null);
    const panel = Array.from(document.querySelectorAll('[role="tabpanel"]')).find((el) => !(el as HTMLElement).hidden) ?? null;
    return { panel: read(panel), main: read(document.querySelector("[data-shell-main]")) };
  });
async function expectScrollersFit(page: Page, label: string) {
  const fit = await scrollerFits(page);
  for (const [name, m] of Object.entries(fit)) {
    expect(m, `${label} ${name}`).not.toBeNull();
    expect(m!.scrollWidth, `${label} ${name}`).toBeLessThanOrEqual(m!.clientWidth);
  }
}
const fullPage = (page: Page) => page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  // Catches: a shell that is not capped to the viewport, so the document scrolls under the panels.
  test(`the shell never scrolls the document at ${size.width} by ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/speedrun");
    await skipToSam(page);
    await skipBuildLog(page);
    for (const label of TABS) {
      await openTab(page, label);
      const m = await fullPage(page);
      expect(m.scrollHeight, label).toBe(m.innerHeight);
    }
  });
}

for (const width of [375, 768, 1440]) {
  // Catches: a bar, badge, tab row or panel wider than the screen.
  test(`no horizontal scroll in the shell at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/speedrun");
    await skipToSam(page);
    await skipBuildLog(page);
    for (const label of TABS) {
      await openTab(page, label);
      const m = await fullPage(page);
      expect(m.scrollWidth, label).toBeLessThanOrEqual(m.innerWidth);
      await expectScrollersFit(page, label);
    }
  });
}

// Catches: wrong grid areas, so the tabs sit in the top bar on a phone or under the panels on desktop.
test("tabs sit at the bottom on a phone and in the top bar on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  const list = page.getByRole("tablist", { name: network.tabsLabel });
  // The phase entrance slides the frame for a moment, so measure once it has settled.
  await expect.poll(() => list.evaluate((el) => Math.abs(el.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => list.evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(200);
});

// Catches: the disclaimer truncated, clipped or pushed off screen (text-overflow ellipsis keeps toHaveText green), or the pinned pill still floating over the shell.
test("the badge shows in full at every width, and the pinned pill is gone in the network phase", async ({ page }) => {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const badge = page.locator("[data-concept-badge]");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(network.badge);
    await expect(page.locator('[data-affiliation="pinned"]')).toHaveCount(0);
    await expect.poll(() => badge.evaluate((el) => el.scrollWidth - el.clientWidth), { message: `badge clipped at ${width}` }).toBeLessThanOrEqual(0);
    const box = (await badge.boundingBox())!;
    expect(box.x, `badge left at ${width}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `badge right at ${width}`).toBeLessThanOrEqual(width);
  }
});

// Catches: the shell sized with the large viewport (100vh), which lets iOS Safari scroll a shell that must never scroll. Chromium has no dynamic toolbar, so read the rule that sizes the section.
test("the act 2 section is sized with the dynamic viewport, never 100vh", async ({ page }) => {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  const heights = await page.evaluate(() => {
    const section = document.getElementById("act-2")!;
    const found: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSStyleRule && section.matches(rule.selectorText) && rule.style.minHeight) found.push(rule.style.minHeight);
      }
    }
    // The shell inside the section is what must never scroll: its own height rule is the one that counts.
    const shell = document.querySelector("[data-shell]")!;
    const shellHeights: string[] = [];
    const collect = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && shell.matches(rule.selectorText) && rule.style.height) shellHeights.push(rule.style.height);
        else if (rule instanceof CSSGroupingRule) collect(rule.cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) collect(sheet.cssRules);
    return { found, shellHeights };
  });
  expect(heights.shellHeights).toContain("100dvh");
  expect(heights.shellHeights).not.toContain("100vh");
  expect(heights.found.length).toBeGreaterThan(0);
  expect(heights.found).not.toContain("100vh");
  expect(heights.found).toContain("100dvh");
});

test.describe("short landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });
  // Catches: the max-height fallback removed, which traps the panels in a shell shorter than their content.
  test("a short landscape screen falls back to page scroll", async ({ page }) => {
    await page.goto("/speedrun");
    await skipToSam(page);
    await skipBuildLog(page);
    const panel = page.getByRole("tabpanel").filter({ visible: true });
    expect(await panel.evaluate((el) => getComputedStyle(el).overflowY)).toBe("visible");
    const m = await fullPage(page);
    expect(m.scrollHeight).toBeGreaterThan(m.innerHeight);
  });
});

test.describe("short portrait", () => {
  // iPhone SE portrait with Safari's bars showing is about 548 px tall: the capped shell must stay capped, not flip to page scroll.
  test.use({ viewport: { width: 375, height: 548 } });
  // Catches: the short-height fallback applying in portrait, which flips the layout to page scroll when the toolbar collapses.
  test("a short portrait screen keeps the shell capped to the viewport", async ({ page }) => {
    await page.goto("/speedrun");
    await skipToSam(page);
    await skipBuildLog(page);
    const result = await page.evaluate(() => ({
      shell: document.querySelector("[data-shell]")!.getBoundingClientRect().height,
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(result.shell).toBe(result.innerHeight);
    expect(result.scrollHeight).toBeLessThanOrEqual(result.innerHeight);
  });
});

// Catches: the account menu staying open after focus moves elsewhere (a Tab out, or a script), because it only closed on Escape and outside presses.
test("the account menu closes when focus leaves it", async ({ page }) => {
  await reachNetwork(page);
  await openAccountMenu(page);
  await page.getByRole("tab", { selected: true }).focus();
  await expect(accountPanel(page)).toBeHidden();
});

// Catches: a long name widening the account button, the menu or the list header past the screen (Review Focus 4).
test("a 40-character name fits at 375", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const name = "W".repeat(40);
  expect(Array.from(name)).toHaveLength(40);
  await page.goto("/speedrun");
  await answerOnboarding(page, { name });
  await skipBuildLog(page);
  let m = await fullPage(page);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.innerWidth);
  // The list header names the visitor too; the panel scrolls on both axes, so the document cannot see it overflow.
  await expect(networkHeading(page)).toContainText(name);
  await expectScrollersFit(page, "40-character name");
  // The list scrolls inside the panel, so a name wider than the list shows up there, not on the panel.
  const list = await page.locator("[data-match-list]").evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  await openAccountMenu(page);
  await expect(accountPanel(page)).toContainText(name);
  m = await fullPage(page);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.innerWidth);
  const box = await accountPanel(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
});

// Catches: Escape closing the menu but leaving focus on the page, or not closing it at all.
test("Escape closes the account menu and returns focus to its button", async ({ page }) => {
  await reachNetwork(page, "Alex");
  await openAccountMenu(page);
  await expect(accountButton(page)).toHaveAttribute("aria-expanded", "true");
  await accountPanel(page).getByRole("button", { name: network.account.startOver }).focus();
  await page.keyboard.press("Escape");
  await expect(accountPanel(page)).toBeHidden();
  await expect(accountButton(page)).toBeFocused();
  await expect(accountButton(page)).toHaveAttribute("aria-expanded", "false");
});

// Catches: an action that runs but leaves the menu open over the phase that is about to leave.
test("Start over from the menu closes it", async ({ page }) => {
  await reachNetwork(page, "Alex");
  await openAccountMenu(page);
  // One frame after the press: React has committed the close, the phase exit (hundreds of ms) has not finished.
  const after = await page.evaluate(async (label) => {
    const panel = document.querySelector<HTMLElement>("[data-account-panel]")!;
    const button = [...panel.querySelectorAll("button")].find((b) => b.textContent === label)!;
    button.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return { hidden: panel.hidden, stillNetwork: !!document.querySelector('[data-phase="network"]') };
  }, network.account.startOver);
  expect(after).toEqual({ hidden: true, stillNetwork: true });
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
});

test("a failed sample build offers Start over, and it lands on a clean step 1", async ({ page }) => {
  await page.route("**/speedrun/api/match", (route) => route.fulfill({ status: 429, contentType: "application/json", body: "{}" }));
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: "Casey", stopAtResume: true });
  const form = page.locator("#join");
  await form.locator('[data-person="sam"]').click();
  await form.getByRole("button", { name: join.finish }).click();
  const building = page.locator('[data-phase="building"]');
  await expect(building.getByText(join.error)).toBeVisible({ timeout: 10_000 });
  await expect(building.getByRole("button", { name: join.retry })).toBeVisible();
  await building.getByRole("button", { name: join.startOver }).click();
  await expect(page.locator('[data-phase="join"]')).toBeVisible({ timeout: 5000 });
  await expect(counter(page)).toHaveText("01 / 07");
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toHaveValue("");
});

// ---- the hero's intro ----

const RUNNING = '[data-hero][data-intro="running"]';

// Catches: the skip listener removed, or one that does not finish the animations in the same tick.
test("a pointerdown during the intro shows the end state in the same tick", async ({ page }) => {
  await page.goto("/speedrun");
  await page.waitForSelector(RUNNING);
  const state = await page.evaluate(() => {
    document.querySelector("[data-hero]")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    return {
      intro: document.querySelector("[data-hero]")!.getAttribute("data-intro"),
      opacities: [...document.querySelectorAll("[data-intro-el], [data-flow-source-value], [data-hero-chart-note]")].filter((el) => el.checkVisibility()).map((el) => getComputedStyle(el).opacity),
      clones: document.querySelectorAll("[data-intro-flight]").length,
    };
  });
  expect(state.intro).toBe("done");
  expect(state.opacities.length).toBeGreaterThan(5);
  expect(state.opacities.every((opacity) => opacity === "1")).toBe(true);
  expect(state.clones).toBe(0);
});

// Catches: a skip that swallows the first key, so focus never moves.
test("Tab during the intro finishes it and moves focus", async ({ page }) => {
  await page.goto("/speedrun");
  await page.waitForSelector(RUNNING);
  await page.keyboard.press("Tab");
  const after = await page.evaluate(() => ({
    intro: document.querySelector("[data-hero]")!.getAttribute("data-intro"),
    focusOnBody: document.activeElement === document.body,
  }));
  expect(after.intro).toBe("done");
  expect(after.focusOnBody).toBe(false);
});

// Catches: the press guard removed, so a press on the button during the intro plays the switch too.
test("a press on the button before the intro settles skips it and does not play the switch", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __stripAnimations: number };
    w.__stripAnimations = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      if (this.matches("[data-shift-strip]")) w.__stripAnimations += 1;
      return original.apply(this, args);
    };
  });
  await page.goto("/speedrun");
  await page.waitForSelector(RUNNING);
  await page.locator("[data-hero-start]").click();
  await expect(page.locator("[data-hero]")).toHaveAttribute("data-intro", "done");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __stripAnimations: number }).__stripAnimations)).toBe(0);
  await expect(page.locator("#act-2")).toHaveCount(0);
});

// Catches: reordered cues, so the closing block stops arriving last.
test("the closing block arrives last", async ({ page }) => {
  await page.goto("/speedrun");
  await page.waitForSelector(RUNNING);
  const delays = await page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target as Element | null | undefined;
      const kind = target?.closest("[data-intro-el]")?.getAttribute("data-intro-el");
      if (!target || !kind) continue;
      const delay = Number(animation.effect!.getTiming().delay);
      out[kind] = Math.max(out[kind] ?? 0, delay);
    }
    return out;
  });
  expect(delays.close).toBe(3000);
  for (const [kind, delay] of Object.entries(delays)) if (kind !== "close") expect(delay, kind).toBeLessThan(delays.close);
});

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  // Catches: the flight or the links aiming at the hidden twin of the chart (a zero rect), or never being created.
  test(`the 84 flies to the visible chart value and the chart is held on the visible twin at ${width} by ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/speedrun");
    await page.waitForSelector(RUNNING);
    const result = await page.evaluate(() => {
      const clone = document.querySelector<HTMLElement>("[data-intro-flight]");
      const flight = clone?.getAnimations().find((a) => a.effect && (a.effect as KeyframeEffect).target === clone);
      flight?.pause();
      if (flight) flight.currentTime = Number(flight.effect!.getComputedTiming().endTime) + 1;
      const centre = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
      };
      const digitsWidth = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width;
      };
      const visible = (selector: string) => [...document.querySelectorAll(selector)].filter((el) => el.checkVisibility());
      const targets = visible("[data-flow-source-value]");
      const clipped = document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null | undefined;
        return target?.matches("[data-flow-content]");
      });
      return {
        hasClone: Boolean(clone),
        targets: targets.length,
        clone: clone ? centre(clone) : null,
        target: targets[0] ? centre(targets[0]) : null,
        digitsWidth: targets[0] ? digitsWidth(targets[0]) : 0,
        clippedVisible: clipped.length > 0 && clipped.every((a) => (a.effect as KeyframeEffect).target!.checkVisibility()),
      };
    });
    expect(result.hasClone).toBe(true);
    expect(result.targets).toBe(1);
    expect(result.clippedVisible).toBe(true);
    expect(Math.abs(result.clone!.x - result.target!.x)).toBeLessThan(3);
    expect(Math.abs(result.clone!.y - result.target!.y)).toBeLessThan(3);
    // Catches: the clone landing at the right centre but several times the size of the digits it replaces.
    expect(result.digitsWidth).toBeGreaterThan(0);
    expect(Math.abs(result.clone!.w - result.digitsWidth) / result.digitsWidth).toBeLessThan(0.3);
    await page.locator("[data-hero]").dispatchEvent("pointerdown");
    await expect(page.locator("[data-hero]")).toHaveAttribute("data-intro", "done");
    await expect(page.locator("[data-intro-flight]")).toHaveCount(0);
    await expect(page.locator("[data-flow-source-value]").filter({ visible: true })).toHaveCSS("opacity", "1");
  });
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  // Catches: the intro ignoring reduced motion (hidden words, or a flying clone).
  test("the end state shows at once and nothing flies", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __flights: number };
      w.__flights = 0;
      new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof Element && node.matches("[data-intro-flight]")) w.__flights += 1;
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto("/speedrun");
    await page.waitForSelector('[data-hero][data-intro="done"]', { timeout: 500 });
    const opacities = await page.evaluate(() => [...document.querySelectorAll("[data-intro-el]")].map((el) => getComputedStyle(el).opacity));
    expect(opacities.length).toBeGreaterThan(5);
    expect(opacities.every((opacity) => opacity === "1")).toBe(true);
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => (window as unknown as { __flights: number }).__flights)).toBe(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  // Catches: the CSS failsafe removed, which would leave the hero's words at opacity 0 forever.
  test("the words still appear", async ({ page }) => {
    await page.goto("/speedrun");
    await page.waitForTimeout(3800);
    const opacities = await page.locator("[data-intro-el], [data-flow-content], [data-hero-chart-note]").evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).map((el) => getComputedStyle(el).opacity));
    expect(opacities.length).toBeGreaterThan(5);
    expect(opacities.every((opacity) => opacity === "1")).toBe(true);
  });
});

// Catches: the intro playing only on the first load, so Replay from the top shows a hero with no motion.
test("Replay from the top plays the intro again", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __introSeen: string[] };
    w.__introSeen = [];
    new MutationObserver((records) => {
      for (const record of records) {
        const value = (record.target as Element).getAttribute("data-intro");
        if (record.attributeName === "data-intro" && value) w.__introSeen.push(value);
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-intro"] });
  });
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  await page.evaluate(() => ((window as unknown as { __introSeen: string[] }).__introSeen = []));
  await replayFromTop(page);
  await expect(page.locator("[data-hero]")).toHaveAttribute("data-intro", "done", { timeout: 8000 });
  expect(await page.evaluate(() => (window as unknown as { __introSeen: string[] }).__introSeen)).toContain("running");
});

test.describe("reduced motion without JavaScript", () => {
  test.use({ reducedMotion: "reduce", javaScriptEnabled: false });
  // Catches: a gate that applies under reduced motion, which hides the hero until the 3.5 s failsafe.
  test("the hero shows the moment the page loads", async ({ page }) => {
    await page.goto("/speedrun");
    const opacities = await page.locator("[data-intro-el], [data-flow-content], [data-hero-chart-note]").evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).map((el) => getComputedStyle(el).opacity));
    expect(opacities.length).toBeGreaterThan(5);
    expect(opacities.every((opacity) => opacity === "1")).toBe(true);
  });
});

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  // Catches: the chart (nodes and labels, not only the links) showing before the 84 lands, or staying clipped after a skip.
  test(`the whole chart is held back until the 84 lands, and a skip shows it at once at ${width} by ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/speedrun");
    await page.waitForSelector(RUNNING);
    const result = await page.evaluate(() => {
      const chart = [...document.querySelectorAll<SVGElement>("[data-flow-content]")].find((el) => el.checkVisibility())!;
      const held = (el: Element) => {
        const style = getComputedStyle(el);
        return style.opacity === "0" || style.clipPath.startsWith("inset(0px 100%");
      };
      const note = document.querySelector("[data-hero-chart-note]")!;
      // Seek to just before the flight lands: the links cue starts at the flight's end, so the chart must still be clipped shut.
      const clone = document.querySelector<HTMLElement>("[data-intro-flight]");
      const flight = clone?.getAnimations().find((a) => (a.effect as KeyframeEffect).target === clone);
      const flightEnd = flight ? Number(flight.effect!.getComputedTiming().endTime) : 0;
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target as Element | null | undefined;
        if (target && (target.closest("[data-hero]") || target === clone)) {
          animation.pause();
          animation.currentTime = flightEnd - 50;
        }
      }
      const seeked = { flightEnd, chartClip: getComputedStyle(chart).clipPath };
      const before = { chartHeld: held(chart), noteHidden: getComputedStyle(note).opacity === "0" };
      document.querySelector("[data-hero]")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      const style = getComputedStyle(chart);
      // Catches: the intro's fill-both animations lingering on the chart and words after done.
      const lingering = document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null | undefined;
        return Boolean(target?.closest("[data-hero]"));
      }).length;
      return { lingering, seeked, before, after: { opacity: style.opacity, clip: style.clipPath, note: getComputedStyle(note).opacity } };
    });
    expect(result.seeked.flightEnd).toBeGreaterThan(50);
    expect(result.seeked.chartClip.startsWith("inset(0px 100%")).toBe(true);
    expect(result.lingering).toBe(0);
    expect(result.before).toEqual({ chartHeld: true, noteHidden: true });
    expect(result.after.opacity).toBe("1");
    expect(["none", "inset(0px)", "inset(0px 0% 0px 0px)"]).toContain(result.after.clip);
    expect(result.after.note).toBe("1");
  });
}

// Catches: the clone outliving its landing, so two 84s overlap until the whole intro ends.
test("the clone leaves the moment the flight lands, and the chart's value is there", async ({ page }) => {
  await page.goto("/speedrun");
  await page.waitForSelector(RUNNING);
  const after = await page.evaluate(async () => {
    const clone = document.querySelector<HTMLElement>("[data-intro-flight]")!;
    const flight = clone.getAnimations().find((a) => (a.effect as KeyframeEffect).target === clone)!;
    await flight.finished;
    const value = [...document.querySelectorAll("[data-flow-source-value]")].find((el) => el.checkVisibility())!;
    return { clones: document.querySelectorAll("[data-intro-flight]").length, value: getComputedStyle(value).opacity, intro: document.querySelector("[data-hero]")!.getAttribute("data-intro") };
  });
  expect(after).toEqual({ clones: 0, value: "1", intro: "running" });
});

test.describe("without checkVisibility", () => {
  // Catches: checkVisibility called without a fallback, which throws in older Safari and leaves the hero blank.
  test("the intro still reaches done", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      delete (Element.prototype as unknown as { checkVisibility?: unknown }).checkVisibility;
    });
    await page.goto("/speedrun");
    await page.waitForSelector(RUNNING);
    // At 390 the narrow twin is the visible one; a fallback of "always shown" would aim the flight at the hidden wide twin.
    const landing = await page.evaluate(() => {
      const clone = document.querySelector<HTMLElement>("[data-intro-flight]")!;
      const flight = clone.getAnimations().find((a) => (a.effect as KeyframeEffect).target === clone)!;
      flight.pause();
      flight.currentTime = Number(flight.effect!.getComputedTiming().endTime) + 1;
      const centre = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
      };
      const shown = [...document.querySelectorAll("[data-flow-source-value]")].filter((el) => el.getClientRects().length > 0);
      const range = document.createRange();
      range.selectNodeContents(shown[0]);
      const measured = { shown: shown.length, clone: centre(clone), target: centre(shown[0]), digitsWidth: range.getBoundingClientRect().width };
      flight.play();
      return measured;
    });
    expect(landing.shown).toBe(1);
    expect(Math.abs(landing.clone.x - landing.target.x)).toBeLessThan(3);
    expect(Math.abs(landing.clone.y - landing.target.y)).toBeLessThan(3);
    expect(landing.digitsWidth).toBeGreaterThan(0);
    expect(Math.abs(landing.clone.w - landing.digitsWidth) / landing.digitsWidth).toBeLessThan(0.3);
    await expect(page.locator("[data-hero]")).toHaveAttribute("data-intro", "done", { timeout: 8000 });
    await expect(page.locator("[data-intro-el]").first()).toHaveCSS("opacity", "1");
  });
});

// Catches: replaying words the failsafe already showed when hydration is slower than 3.5 s.
test("a hydration slower than the failsafe goes straight to done", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __introSeen: string[] };
    w.__introSeen = [];
    new MutationObserver((records) => {
      for (const record of records) {
        const value = (record.target as Element).getAttribute("data-intro");
        if (value) w.__introSeen.push(value);
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-intro"] });
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4500));
    await route.continue().catch(() => {});
  });
  await page.goto("/speedrun", { waitUntil: "commit" });
  await page.waitForTimeout(4000);
  await expect(page.locator("[data-intro-el]").first()).toHaveCSS("opacity", "1");
  await expect(page.locator("[data-hero]")).toHaveAttribute("data-intro", "done", { timeout: 15_000 });
  expect(await page.evaluate(() => (window as unknown as { __introSeen: string[] }).__introSeen)).toEqual(["done"]);
});

// Catches: the button's pressable moment tied to the whole intro ending (about 3.4 s) instead of its own cue (3 s).
test("the button plays the switch from its own cue, before the intro has ended", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __introStart: number };
    new MutationObserver(() => {
      if (!w.__introStart && document.querySelector('[data-hero][data-intro="running"]')) w.__introStart = performance.now();
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-intro"] });
  });
  await page.goto("/speedrun");
  await page.waitForSelector(RUNNING);
  const pressedWhile = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const start = (window as unknown as { __introStart: number }).__introStart;
        const tick = () => {
          if (performance.now() - start < 3080) return requestAnimationFrame(tick);
          const intro = document.querySelector("[data-hero]")!.getAttribute("data-intro")!;
          const button = document.querySelector<HTMLElement>("[data-hero-start]")!;
          button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
          button.click();
          resolve(intro);
        };
        tick();
      }),
  );
  expect(pressedWhile).toBe("running");
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
});
