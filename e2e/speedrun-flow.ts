import { speedrunCopy } from "../lib/content";
import { introCues, type IntroCue } from "../lib/speedrun/heroIntro";
import { MOTION } from "../lib/speedrun/motion";
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

/** The intro's schedule for the words on this page, so pins read the cue times instead of hard-coding them. */
export async function introSchedule(page: Page): Promise<IntroCue[]> {
  const count = (kind: string) => page.locator(`[data-intro-el="${kind}"]`).count();
  return introCues(MOTION, { words: await count("word"), subtitleWords: await count("subtitle"), paragraphs: await count("paragraph") });
}

/** Holds the running intro at `ms`: every animation of the hero, its flying 84 and the spotlight layer is paused and seeked. */
export async function seekIntro(page: Page, ms: number) {
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target as Element | null | undefined;
      if (!target?.closest("[data-hero], [data-spotlight], [data-intro-flight]")) continue;
      animation.pause();
      animation.currentTime = at;
    }
  }, ms);
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
  /** Labels whose backing (the glyphs grown by the dilate radius) touches a node bar. */
  onNodes: string[];
  /** Pairs of labels whose backings touch. */
  overlapping: string[];
  /** Labels whose backing is missing or wrong: no filter, not sRGB, not the backdrop colour, not under the text, a region too small, or a node or link painted after the label. */
  unbacked: string[];
  /** Labels whose backing is cut by the edge of their SVG. */
  clipped: string[];
};

// The dilate radius of the label backing (BACKING in lib/speedrun/flowLabels.ts), restated so a wrong constant there goes red.
const BACKING_PX = 3;

/**
 * Geometry probe for the visible flow chart(s) under `root`. A chart's content group is the one holding its
 * `<text>` labels; the hero marks it `[data-flow-content]`. Run it once fonts are ready.
 */
export async function probeFlowLabels(page: Page, root: string): Promise<LabelProbe> {
  return page.evaluate(
    ({ rootSelector, backing }) => {
      type Box = { x: number; y: number; width: number; height: number };
      const hit = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by });
      const at = (b: Box) => `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
      const out: LabelProbe = { labels: 0, onNodes: [], overlapping: [], unbacked: [], clipped: [] };
      const backdropOf = (el: Element) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const color = getComputedStyle(node).backgroundColor;
          if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
        }
        return "rgba(0, 0, 0, 0)";
      };
      const svgs = [...document.querySelectorAll<SVGSVGElement>(`${rootSelector} svg[role="img"]`)].filter((s) => s.getBoundingClientRect().width > 0);
      for (const svg of svgs) {
        const g = svg.querySelector("text")?.closest("g")?.parentElement as SVGGElement | null;
        if (!g) continue;
        const texts = [...g.querySelectorAll("text")];
        const rects = [...g.querySelectorAll("rect")];
        const paths = [...g.querySelectorAll("path")];
        const svgRect = svg.getBoundingClientRect();
        const scale = svgRect.width / svg.viewBox.baseVal.width;
        const boxes = texts.map((t) => ({ t, b: t.getBBox(), s: (t.textContent ?? "").replace(/\s+/g, " ").trim() }));
        out.labels += boxes.length;
        boxes.forEach((a, i) => {
          const mine = grow(a.b, backing);
          const under = rects.find((r) => hit(mine, r.getBBox()));
          if (under) out.onNodes.push(`${a.s} [${at(a.b)}] on [${at(under.getBBox())}]`);
          boxes.slice(i + 1).forEach((b) => {
            if (hit(mine, grow(b.b, backing))) out.overlapping.push(`${a.s} / ${b.s}`);
          });

          const client = a.t.getBoundingClientRect();
          const reach = backing * scale;
          if (client.left - reach < svgRect.left - 0.5 || client.right + reach > svgRect.right + 0.5 || client.top - reach < svgRect.top - 0.5 || client.bottom + reach > svgRect.bottom + 0.5) {
            out.clipped.push(`${a.s} [${at(a.b)}]`);
          }

          const id = /url\("?#([^")]+)"?\)/.exec(getComputedStyle(a.t).filter)?.[1];
          const filter = id ? document.getElementById(id) : null;
          const flood = filter?.querySelector("feFlood");
          const nodes = [...(filter?.querySelectorAll("feMergeNode") ?? [])];
          const region = filter
            ? {
                x: a.b.x + a.b.width * parseFloat(filter.getAttribute("x") ?? "-0.1"),
                y: a.b.y + a.b.height * parseFloat(filter.getAttribute("y") ?? "-0.1"),
                width: a.b.width * parseFloat(filter.getAttribute("width") ?? "1.4"),
                height: a.b.height * parseFloat(filter.getAttribute("height") ?? "1.2"),
              }
            : null;
          const covers = !!region && region.x <= mine.x && region.y <= mine.y && region.x + region.width >= mine.x + mine.width && region.y + region.height >= mine.y + mine.height;
          const painted = (other: Element) => !!(a.t.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING);
          const reasons: string[] = [];
          if (!flood) reasons.push("no filter");
          else {
            if (getComputedStyle(flood).floodColor !== backdropOf(svg)) reasons.push(`flood ${getComputedStyle(flood).floodColor} is not the backdrop ${backdropOf(svg)}`);
            if (getComputedStyle(flood).floodOpacity !== "1") reasons.push("flood not opaque");
            if (getComputedStyle(flood).colorInterpolationFilters.toLowerCase() !== "srgb") reasons.push("not sRGB");
            if (nodes.at(-1)?.getAttribute("in") !== "SourceGraphic") reasons.push("text not merged last");
            if (!covers) reasons.push("filter region too small");
            if (!filter?.querySelector('feMorphology[operator="dilate"]')) reasons.push("no dilate");
          }
          if (rects.some(painted) || paths.some(painted)) reasons.push("a node or link paints after it");
          if (reasons.length) out.unbacked.push(`${a.s}: ${reasons.join(", ")}`);
        });
      }
      return out;
    },
    { rootSelector: root, backing: BACKING_PX },
  );
}
