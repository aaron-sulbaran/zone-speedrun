import { speedrunCopy } from "../lib/content";
import { renderBriefEmail } from "../lib/speedrun/brief";
import { sampleBrief } from "../lib/speedrun/briefSample";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { answerOnboarding, openTab, skipBuildLog } from "./speedrun-flow";

const COPY = speedrunCopy.brief;

async function joinAs(page: Page, key: "sam" | "maya") {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: key === "sam" ? "Sam" : "Maya", person: key, connectGmail: true });
  await skipBuildLog(page);
  await openTab(page, speedrunCopy.network.tabs.brief);
  await expect(page.locator("[data-brief]")).toBeVisible({ timeout: 20_000 });
}

test("the brief previews as an email with the first name in its subject", async ({ page }) => {
  await joinAs(page, "sam");
  const subject = page.locator("[data-brief-subject]");
  await expect(subject).toContainText("Sam");
  await expect(subject).toHaveText(renderBriefEmail(sampleBrief("sam"), "Sam").subject);
  const items = sampleBrief("sam").items;
  await expect(page.locator("#sr-brief-heading")).toHaveText(COPY.heading);
  await expect(page.locator("[data-brief-item]")).toHaveText(items.map((item) => item.text));
  await expect(page.locator("[data-brief-item]").first()).toHaveAttribute("data-brief-item", items[0].kind);
});

test("a quiet person gets the short brief", async ({ page }) => {
  await joinAs(page, "maya");
  await expect(page.locator("[data-brief-subject]")).toHaveText(COPY.quietSubject("Maya"));
  await expect(page.locator("[data-brief-quiet]")).toBeVisible();
});

test("with email off the page shows the off line and no address field", async ({ page }) => {
  await joinAs(page, "sam");
  await expect(page.locator("[data-brief-off]")).toHaveText(COPY.send.off);
  await expect(page.locator("[data-brief] input")).toHaveCount(0);
  await expect(page.locator("[data-brief-send]")).toHaveCount(0);
});
