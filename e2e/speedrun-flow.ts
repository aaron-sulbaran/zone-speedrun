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

/** Opens /speedrun when the page is blank, presses the switch and waits for the join card to be ready. */
export async function playSwitch(page: Page) {
  if (page.url() === "about:blank") await page.goto("/speedrun");
  await page.getByRole("button", { name: speedrunCopy.shift.button }).click();
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
