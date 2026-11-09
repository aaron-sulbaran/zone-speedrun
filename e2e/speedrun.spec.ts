import type { Page } from "@playwright/test";
import { siteContent, speedrunCopy } from "../lib/content";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, joinPhase, networkHeading, networkPhase, openTab, playSwitch, skipBuildLog, skipToSam } from "./speedrun-flow";

// The site's MVP link label (quickCopy.titleShort on the site), kept literal here.
const QUICK_TITLE_SHORT = "MVP";

const network = speedrunCopy.network;
const join = speedrunCopy.join;
const switchButton = (page: Page) => page.getByRole("button", { name: speedrunCopy.shift.button });
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

  await page.getByRole("button", { name: "Open menu" }).click();
  const panel = page.getByRole("dialog", { name: "Site menu" });
  // Off the home page the menu's Home item is the way back to "/".
  await panel.getByRole("link", { name: /Home/ }).click();
  await page.waitForURL((url) => url.pathname === "/");
});

test("the opener shows first, with no phase of the styled section in the DOM", async ({ page }) => {
  await page.goto("/speedrun");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(speedrunCopy.act1.headline1);
  await expect(page.locator('section[data-act="1"]')).toBeVisible();
  await expect(page.locator('[data-act="1"] [data-funnel-stat="applications"]')).toHaveText("84");
  expect(await page.locator('[data-act="1"] svg path.flow-link').count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator("#act-2")).toHaveCount(0);
  await expect(page.locator("[data-phase]")).toHaveCount(0);
  await expect(page.locator("#join")).toHaveCount(0);
  await expect(page.getByText(speedrunCopy.shift.turnLine1)).toBeVisible();
});

test("with motion the same click starts the sweep on the strip", async ({ page }) => {
  await page.goto("/speedrun");
  const [animations, visibility] = await page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
    const strip = document.querySelector<HTMLElement>("[data-shift-strip]")!;
    button.click();
    return [strip.getAnimations().length, getComputedStyle(strip).visibility] as const;
  }, speedrunCopy.shift.button);
  expect(animations).toBeGreaterThanOrEqual(1);
  expect(visibility).toBe("visible");
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
});

test("the switch lands on the join card at the top of the page with the name input focused", async ({ page }) => {
  await page.goto("/speedrun");
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
  await expect(networkHeading(page)).toHaveText(network.heading("Alex"));
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
  await page.getByRole("button", { name: network.startOver }).click();
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toHaveValue("");
  await expect(counter(page)).toHaveText("01 / 07");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await answerOnboarding(page, { name: "Blake" });
  await skipBuildLog(page);
  await expect(networkHeading(page)).toHaveText(network.heading("Blake"));
  await page.getByRole("button", { name: network.replayTop }).click();
  await expect(page.locator('section[data-act="1"]')).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#act-2")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The opener is armed again: the switch plays and the join card starts clean.
  await playSwitch(page);
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toHaveValue("");
  await expect(counter(page)).toHaveText("01 / 07");
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
  await expect(networkHeading(page)).toHaveText(network.heading("Dana"));
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
  await expect(networkHeading(page)).toHaveText(network.heading(name));
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
    await page.goto("/speedrun");
    // play() starts the strip's animation synchronously inside the click, so read it in the same tick.
    const [animations, visibility] = await page.evaluate((label) => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
      const strip = document.querySelector<HTMLElement>("[data-shift-strip]")!;
      button.click();
      return [strip.getAnimations().length, getComputedStyle(strip).visibility] as const;
    }, speedrunCopy.shift.button);
    expect([animations, visibility]).toEqual([0, "hidden"]);
    await expect(joinPhase(page)).toBeVisible({ timeout: 4000 });
    await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
    await expect(page.locator("[data-shift-strip]")).toBeHidden();
  });

  test("the skip path lands on the network with no Continue press", async ({ page }) => {
    await page.goto("/speedrun");
    await playSwitch(page);
    await page.getByRole("button", { name: speedrunCopy.hero.ctaSecondary }).first().click();
    await expect(networkPhase(page)).toBeVisible({ timeout: 10_000 });
    await expect(networkHeading(page)).toBeFocused();
    await expect(networkHeading(page)).toHaveText(network.heading("Sam"));
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
    await expect(networkHeading(page)).toHaveText(network.heading("Alex"));
  });
});

test.describe("short viewport", () => {
  test.use({ viewport: { width: 1440, height: 400 } });
  test("the switch lands at the top and Replay from the top re-arms it", async ({ page }) => {
    await page.goto("/speedrun");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await switchButton(page).scrollIntoViewIfNeeded();
    await switchButton(page).click();
    await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByRole("button", { name: speedrunCopy.hero.ctaSecondary }).first().click();
    await skipBuildLog(page);
    await page.getByRole("button", { name: network.replayTop }).click();
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
    }
    await page.locator("[data-close]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test("the decisions and the close are on the page", async ({ page }) => {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  await openTab(page, network.tabs.decisions);
  const section = page.locator("[data-decisions]");
  await expect(section.getByRole("heading", { name: speedrunCopy.decisions.heading })).toBeVisible();
  await expect(section.locator("[data-decision-card]")).toHaveCount(6);
  await expect(page.locator("[data-close]").getByRole("heading", { name: speedrunCopy.close.eyebrow })).toBeAttached();
  const linkedin = siteContent.menu.socials.find((social) => social.key === "linkedin")?.href;
  const links = page.locator("[data-close] a");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveAttribute("href", "/");
  await expect(links.nth(1)).toHaveAttribute("href", "/quick");
  await expect(links.nth(1)).toHaveText(QUICK_TITLE_SHORT);
  await expect(links.nth(2)).toHaveAttribute("href", linkedin ?? "");
  await expect(links.nth(2)).toHaveAttribute("target", "_blank");
  await expect(links.nth(2)).toHaveAttribute("rel", "noopener noreferrer");
});

test("the pinned affiliation steps aside at the close, which carries the line", async ({ page }) => {
  await page.goto("/speedrun");
  await skipToSam(page);
  await skipBuildLog(page);
  await page.locator("[data-close]").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-affiliation="pinned"]')).toHaveAttribute("aria-hidden", "true");
  const gap = await page.evaluate(() => {
    const close = document.querySelector("[data-close]")!.getBoundingClientRect();
    return document.documentElement.scrollHeight - (close.bottom + window.scrollY);
  });
  expect(gap).toBeLessThanOrEqual(1);
});

test("the sitemap leaves /speedrun out", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();
  expect(body).not.toContain("speedrun");
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
