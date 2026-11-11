import { speedrunCopy } from "../lib/content";
import type { Arrangement, StepKey } from "../lib/speedrun/onboarding";
import type { Fn, PersonKey } from "../lib/speedrun/types";
import { expect, type Page } from "@playwright/test";

// Shared steps for the phased /speedrun flow: the opener, the switch, the join
// card, the build and the network. A spec starts from page.goto("/speedrun") (or
// lets playSwitch do it) and calls only the steps it needs.

const join = speedrunCopy.join;

export type OnboardingOptions = {
  name?: string;
  targets?: Fn[];
  student?: boolean;
  arrangements?: Arrangement[];
  places?: string[];
  founding?: boolean;
  why?: string;
  person?: PersonKey;
  connectGmail?: boolean;
  /** Stop on the last question, before a sample person is picked (the upload spec and the reset specs go on from there). */
  stopAtResume?: boolean;
  /** Runs when a question is on screen, before it is answered. */
  onStep?: (step: StepKey) => Promise<void>;
};

export const joinPhase = (page: Page) => page.locator('#act-2[data-phase="join"]');
export const networkPhase = (page: Page) => page.locator('#act-2[data-phase="network"]');
export const networkHeading = (page: Page) => networkPhase(page).locator("[data-phase-heading]");

/** Skips the hero's intro (any pointerdown does) and waits for fonts, so rects are measured at rest. */
export async function settleHero(page: Page) {
  const hero = page.locator("[data-hero]");
  await page.waitForSelector("[data-hero][data-intro]");
  await hero.dispatchEvent("pointerdown");
  await expect(hero).toHaveAttribute("data-intro", "done");
  await page.evaluate(() => document.fonts.ready);
}

/** Opens /speedrun when the page is blank, presses the switch and waits for the join card to be ready. */
export async function playSwitch(page: Page) {
  if (page.url() === "about:blank") await page.goto("/speedrun");
  await settleHero(page);
  await page.getByRole("button", { name: speedrunCopy.act1.closing.button }).click();
  await expect(joinPhase(page)).toBeVisible({ timeout: 8000 });
  await expect(page.locator("[data-shift-strip]")).toBeHidden({ timeout: 8000 });
  await expect(page.locator("#join").getByLabel(join.steps.name.inputLabel)).toBeFocused();
}

const card = (page: Page) => page.locator("#join");
const question = (page: Page, key: keyof typeof join.steps) => card(page).getByRole("heading", { name: join.steps[key].question });

async function advance(page: Page, next: keyof typeof join.steps) {
  await card(page).getByRole("button", { name: join.next }).click();
  await expect(question(page, next)).toBeVisible();
}

// A Yes or No pill advances on its own a beat after the tap, so there is no Continue to press.
async function choose(page: Page, answer: boolean, next: keyof typeof join.steps) {
  await card(page).getByRole("radio", { name: answer ? join.yes : join.no, exact: true }).click();
  await expect(question(page, next)).toBeVisible();
}

/** Answers every question and presses Build my network. Ends on the building phase. */
export async function answerOnboarding(page: Page, opts: OnboardingOptions = {}) {
  const { name = "Alex", targets = ["product"], student = false, arrangements = [], places = [], founding = false, why = "", person = "sam", connectGmail = false, stopAtResume = false, onStep } = opts;
  const at = async (step: StepKey) => void (await onStep?.(step));
  if ((await page.locator("#join").count()) === 0) await playSwitch(page);
  const form = card(page);

  await at("name");
  await form.getByLabel(join.steps.name.inputLabel).fill(name);
  await advance(page, "targets");
  await at("targets");
  for (const target of targets) await form.getByRole("button", { name: join.targetLabels[target], exact: true }).click();
  await advance(page, "student");
  await at("student");
  await choose(page, student, student ? "arrangements" : "places");
  if (student) {
    await at("arrangements");
    for (const item of arrangements.length ? arrangements : (["between"] as Arrangement[])) {
      await form.getByRole("button", { name: join.steps.arrangements.options[item], exact: true }).click();
    }
    await advance(page, "places");
  }
  await at("places");
  for (const place of places) await form.getByRole("button", { name: place, exact: true }).click();
  await advance(page, "founding");
  await at("founding");
  await choose(page, founding, "why");
  await at("why");
  if (why) await form.getByLabel(join.steps.why.inputLabel).fill(why);
  await advance(page, "resume");
  await at("resume");
  if (stopAtResume) return;
  await form.locator(`[data-person="${person}"]`).click();
  if (connectGmail) await form.getByRole("button", { name: join.connect.gmail }).click();
  await form.getByRole("button", { name: join.finish }).click();
  await expect(page.locator('#act-2[data-phase="building"]')).toBeVisible({ timeout: 8000 });
}

/** The hero's skip button: Sam, with the inbox connected. Ends on the building phase. */
export async function skipToSam(page: Page) {
  if ((await page.locator("#join").count()) === 0) await playSwitch(page);
  await page.getByRole("button", { name: speedrunCopy.hero.ctaSecondary }).first().click();
  await expect(page.locator('#act-2[data-phase="building"]')).toBeVisible({ timeout: 8000 });
}

/**
 * Gets from the build to the network. With motion, the log's Skip jumps to the end and the network follows;
 * under reduced motion the log is already finished, and a run that answered the questions waits for Continue.
 */
export async function skipBuildLog(page: Page) {
  const log = page.locator("[data-build-log]");
  await expect(log.or(networkPhase(page))).toBeVisible({ timeout: 20_000 });
  const skip = log.getByRole("button", { name: speedrunCopy.build.skip });
  const proceed = page.getByRole("button", { name: speedrunCopy.build.continue });
  for (let i = 0; i < 40 && (await networkPhase(page).count()) === 0; i++) {
    if (await skip.isVisible()) await skip.click().catch(() => {});
    else if (await proceed.isVisible()) await proceed.click().catch(() => {});
    else await page.waitForTimeout(250);
  }
  await expect(networkPhase(page)).toBeVisible({ timeout: 10_000 });
  await expect(networkHeading(page)).toBeFocused();
}

/** Selects a network tab by its label and waits for it to be selected. */
export async function openTab(page: Page, label: string) {
  const tab = page.getByRole("tab", { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

export const accountButton = (page: Page) => page.getByRole("button", { name: speedrunCopy.network.account.label });
export const accountPanel = (page: Page) => page.locator("[data-account-panel]");

/** Opens the account menu and waits for its panel. */
export async function openAccountMenu(page: Page) {
  await accountButton(page).click();
  await expect(accountPanel(page)).toBeVisible();
}

/** Start over from the network, through the account menu. */
export async function startOver(page: Page) {
  await openAccountMenu(page);
  await accountPanel(page).getByRole("button", { name: speedrunCopy.network.account.startOver }).click();
}

/** Back to the opener from the network, through the account menu. */
export async function replayFromTop(page: Page) {
  await openAccountMenu(page);
  await accountPanel(page).getByRole("button", { name: speedrunCopy.network.account.replayTop }).click();
  await expect(page.locator("[data-hero]")).toBeVisible({ timeout: 8000 });
}

/** The account menu names the visitor in full. */
export async function expectVisitorName(page: Page, name: string) {
  await openAccountMenu(page);
  await expect(accountPanel(page)).toContainText(name);
  await page.keyboard.press("Escape");
  await expect(accountPanel(page)).toBeHidden();
}

export type LabelProbe = {
  labels: number;
  /** Labels whose box, grown by 2 px, touches a node bar. */
  onNodes: string[];
  /** Pairs of labels whose boxes touch. */
  overlapping: string[];
  /** Labels with no opaque backing, a backing in another colour than the halo, or a node or link painted after them. */
  unbacked: string[];
};

/**
 * Geometry probe for the visible flow chart(s) under `root`. A chart's content group is the one holding its
 * `<text>` labels; the hero marks it `[data-flow-content]`. Run it once fonts are ready.
 */
export async function probeFlowLabels(page: Page, root: string): Promise<LabelProbe> {
  return page.evaluate((rootSelector) => {
    type Box = { x: number; y: number; width: number; height: number };
    const hit = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by });
    const out: LabelProbe = { labels: 0, onNodes: [], overlapping: [], unbacked: [] };
    const svgs = [...document.querySelectorAll<SVGSVGElement>(`${rootSelector} svg[role="img"]`)].filter((s) => s.getBoundingClientRect().width > 0);
    for (const svg of svgs) {
      const g = svg.querySelector("text")?.closest("g")?.parentElement as SVGGElement | null;
      if (!g) continue;
      const texts = [...g.querySelectorAll("text")];
      const rects = [...g.querySelectorAll("rect")];
      const paths = [...g.querySelectorAll("path")];
      const boxes = texts.map((t) => ({ t, b: t.getBBox(), s: (t.textContent ?? "").replace(/\s+/g, " ").trim() }));
      out.labels += boxes.length;
      boxes.forEach((a, i) => {
        const at = (b: Box) => `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
        const under = rects.find((r) => hit(grow(a.b, 2), r.getBBox()));
        if (under) out.onNodes.push(`${a.s} [${at(a.b)}] on [${at(under.getBBox())}]`);
        boxes.slice(i + 1).forEach((b) => {
          if (hit(a.b, b.b)) out.overlapping.push(`${a.s} / ${b.s}`);
        });
        const filterUrl = getComputedStyle(a.t).filter;
        const id = /url\("?#([^")]+)"?\)/.exec(filterUrl)?.[1];
        const flood = id ? document.getElementById(id)?.querySelector("feFlood") : null;
        const halo = getComputedStyle(a.t).stroke;
        const painted = (other: Element) => !!(a.t.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING);
        const backed = !!flood && getComputedStyle(flood).floodColor === halo && getComputedStyle(flood).floodOpacity === "1";
        if (!backed || rects.some(painted) || paths.some(painted)) out.unbacked.push(a.s);
      });
    }
    return out;
  }, root);
}
