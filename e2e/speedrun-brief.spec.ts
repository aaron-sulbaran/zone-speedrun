import { speedrunCopy } from "../lib/content";
import { cleanUrl } from "../lib/speedrun/cleanUrl";
import { renderBriefEmail } from "../lib/speedrun/brief";
import { sampleBrief } from "../lib/speedrun/briefSample";
import { getSnapshot } from "../lib/speedrun/snapshot";
import type { Page } from "@playwright/test";
import { test, expect, pinToday } from "./support/fixtures";
import { DETAILS } from "../lib/speedrun/details";
import { whenLabel } from "../lib/speedrun/when";
import { PERSON_KEYS } from "../lib/speedrun/types";
import { answerOnboarding, openTab, skipBuildLog, tabKey } from "./speedrun-flow";

const COPY = speedrunCopy.brief;
const ACTIONS = speedrunCopy.actions;
const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const bodyOverflow = (page: Page) => page.evaluate(() => getComputedStyle(document.body).overflow);

async function joinAs(page: Page, key: "sam" | "maya", connectGmail = true) {
  await page.goto("/speedrun");
  await answerOnboarding(page, { name: key === "sam" ? "Sam" : "Maya", person: key, connectGmail });
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
  // Catches: a line's words lost or changed once its button sits beside them.
  await expect(page.locator("[data-brief-item] [data-brief-text]")).toHaveText(items.map((item) => item.text));
  await expect(page.locator("[data-brief-item]").first()).toHaveAttribute("data-brief-item", items[0].kind);
});

test("a quiet person gets the short brief", async ({ page }) => {
  await joinAs(page, "maya");
  await expect(page.locator("[data-brief-subject]")).toHaveText(COPY.quietSubject("Maya"));
  await expect(page.locator("[data-brief-quiet]")).toBeVisible();
});

test("with email off the page shows one channel line and no address field", async ({ page }) => {
  await joinAs(page, "sam");
  // Catches: the old pair coming back (an "only email works" line over a separate "sending is off" line), which contradict each other.
  const note = page.locator("[data-brief-channel-note]");
  await expect(note).toHaveCount(1);
  // Catches: the live variant (channelNoteLive, no "switched off") rendering while sending is off, or any wording other than the one approved channel line.
  await expect(note).toHaveText(COPY.channelNote);
  // Catches: the switched-off wording appearing a second time under the channel line.
  expect((await page.locator("[data-brief]").innerText()).match(/switched off/g)).toHaveLength(1);
  // Catches: the retired "only email works" line coming back beside the new one.
  await expect(page.locator("[data-brief]")).not.toContainText(/only email works/i);
  // Catches: the retired separate off paragraph (data-brief-off) rendering, even when hidden from the text count above.
  await expect(page.locator("[data-brief-off]")).toHaveCount(0);
  await expect(page.locator("[data-brief] input")).toHaveCount(0);
  await expect(page.locator("[data-brief-send]")).toHaveCount(0);
});

for (const connectGmail of [true, false]) {
  for (const key of PERSON_KEYS) {
    test(`the subject's count equals the lines shown: ${key}, ${connectGmail ? "Gmail connected" : "no Gmail"}`, async ({ page }) => {
      await page.goto("/speedrun");
      await answerOnboarding(page, { name: "Testy", person: key, connectGmail });
      await skipBuildLog(page);
      await openTab(page, speedrunCopy.network.tabs.brief);
      await expect(page.locator("[data-brief]")).toBeVisible({ timeout: 20_000 });
      const subject = await page.locator("[data-brief-subject]").innerText();
      const shown = await page.locator("[data-brief-item]").count();
      const said = subject.match(/(\d+) things? (?:moved overnight|still open)/);
      // Catches: a subject that counts fewer (or more) things than the brief lists, such as "2 things moved overnight" over three lines.
      if (said) expect(Number(said[1]), subject).toBe(shown);
      // Catches: a brief with no lines whose subject is not the quiet one.
      else if (shown === 0) expect(subject).toMatch(/nothing moved/i);
      else {
        // Catches: a count-less subject over lines that is not the "nothing new overnight" form.
        expect(subject).toContain("nothing new overnight");
        // Catches: the single still-open form sitting over more than one line.
        expect(shown, subject).toBe(1);
      }
    });
  }
}

const sheet = (page: Page) => page.locator("dialog[data-action-sheet]");
const lines = (page: Page) => page.locator("[data-brief-item]");

test("brief action: every one of Sam's lines has its one-tap button", async ({ page }) => {
  await joinAs(page, "sam");
  const buttons = ACTIONS.briefButtons;
  await expect(lines(page)).toHaveCount(3);
  // Catches: a dead brief line, one that says what to do and gives no way to do it.
  for (let i = 0; i < 3; i++) await expect(lines(page).nth(i).locator("[data-brief-action]")).toHaveCount(1);
  // Catches: a button that names a different action from the line it sits on (read off the wrong row).
  await expect(lines(page).locator("[data-brief-action]")).toHaveText([buttons.pickTime, buttons.replyTimes, buttons.confirmInterview]);
});

test("brief action: tapping a time sends that time, dims the line and keeps it in place", async ({ page }) => {
  await joinAs(page, "sam");
  const unlocked = await bodyOverflow(page);
  const first = lines(page).first();
  const words = await first.locator("[data-brief-text]").innerText();
  await first.locator("[data-brief-action]").click();
  // Catches: a button that opens nothing.
  await expect(sheet(page)).toBeVisible();
  // Catches: Splits' draft shown with no label saying who wrote it.
  await expect(sheet(page)).toContainText(ACTIONS.sheetUi.drafted);
  // Catches: an empty draft, a sheet that is not already filled in.
  await expect(sheet(page)).toContainText(ACTIONS.sheets.pickTime.draft());
  // Catches: Pick a time showing fewer than the three one-tap slots.
  await expect(sheet(page).locator("[data-sheet-slot]")).toHaveCount(3);
  // Catches: a sheet that lets the visitor think something was really sent.
  await expect(sheet(page).locator("[data-sheet-note]")).toHaveText(ACTIONS.sheets.pickTime.note);
  // Catches: Pick a time keeping a shared send-all button, which sends three times and picks none.
  await expect(sheet(page).locator("[data-sheet-confirm]")).toHaveCount(0);
  // Catches: a time button under the 44 px touch size.
  for (const height of await sheet(page).locator("[data-sheet-slot]").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
  const second = sheet(page).locator("[data-sheet-slot]").nth(1);
  const time = (await second.innerText()).trim();
  await second.click();
  // Catches: the sheet staying open after the one decision is made.
  await expect(sheet(page)).toBeHidden();
  // Catches: a confirmed line not marked done.
  await expect(first).toHaveAttribute("data-done", "true");
  // Catches: the line saying nothing plain about what happened.
  await expect(first.locator("[data-brief-done]")).toHaveText(`${ACTIONS.sheets.pickTime.done} ${time}`);
  // Catches: the scroll lock still on after a confirm (the sheet closes by unmounting, not by Escape).
  await expect.poll(() => bodyOverflow(page)).toBe(unlocked);
  // Catches: a done line removed, or reworded, instead of dimmed in place.
  await expect(lines(page)).toHaveCount(3);
  await expect(lines(page).first().locator("[data-brief-text]")).toHaveText(words);
  // Catches: a confirmed line keeping a live button, which could send the same reply twice.
  await expect(first.locator("[data-brief-action]")).toHaveCount(0);
  // Catches: focus dropping to the page when the tapped time swaps the line's button for "Sent", which should take it.
  await expect(first.locator("[data-brief-done]")).toBeFocused();
  // Catches: a done line that does not look quiet.
  await expect(first).toHaveCSS("opacity", "0.7");
  // Catches: the other lines marked done along with it.
  await expect(lines(page).nth(1)).toHaveAttribute("data-done", "false");
});

test("brief action: the sheet traps Tab, locks the page, closes on Escape and returns focus to its opener", async ({ page, browserName }) => {
  await joinAs(page, "sam");
  const opener = lines(page).nth(1).locator("[data-brief-action]");
  const overflow = () => bodyOverflow(page);
  // The lock only means something if the page was not already unscrollable.
  const unlocked = await overflow();
  expect(unlocked).not.toBe("hidden");
  await opener.click();
  await expect(sheet(page)).toBeVisible();
  const inside = () => page.evaluate(() => !!document.activeElement?.closest("dialog[data-action-sheet]"));
  // Catches: focus left on the page behind the sheet.
  expect(await inside()).toBe(true);
  // Catches: the page scrolling behind an open sheet.
  expect(await overflow()).toBe("hidden");
  // Catches: Tab leaving the sheet for the page behind it, forward and back.
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(tabKey(browserName));
    expect(await inside(), `Tab ${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(`Shift+${tabKey(browserName)}`);
    expect(await inside(), `Shift+Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  // Catches: Escape leaving the sheet open.
  await expect(sheet(page)).toBeHidden();
  // Catches: focus lost to the page top once the sheet closes.
  await expect(opener).toBeFocused();
  // Catches: Escape marking the line done, which would send without a decision.
  await expect(lines(page).nth(1)).toHaveAttribute("data-done", "false");
  // Catches: the scroll lock outliving the sheet.
  await expect.poll(overflow).toBe(unlocked);
});

test("brief action: Bring forward adds the role to the shortlist, and Apply is the real posting link", async ({ page }) => {
  await joinAs(page, "sam", false);
  const line = lines(page).first();
  await expect(line).toHaveAttribute("data-brief-item", "new-role");
  const apply = line.locator("[data-brief-apply]");
  const href = await apply.getAttribute("href");
  // Catches: Apply drawn as a button that goes nowhere.
  expect(getSnapshot().roles.some((role) => cleanUrl(role.url) === href), `${href}`).toBe(true);
  // Catches: a person's click carrying the snapshot's agent tags (utm_medium=agent).
  expect(href).not.toContain("utm_medium=agent");
  // Catches: a posting link that leaves this tab behind or leaks the opener.
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", "noopener noreferrer");
  // Catches: the Apply link worded as something else, or missing its words.
  await expect(apply).toHaveText(ACTIONS.briefButtons.apply);
  await line.locator("[data-brief-action]").click();
  // Catches: Bring forward drafting a note to the company, which sends nothing and is not what it does.
  await expect(sheet(page).locator("[data-sheet-draft]")).toHaveCount(0);
  // Catches: the Bring forward sheet saying nothing about where the role lands.
  await expect(sheet(page).locator("[data-sheet-summary]")).toContainText(/shortlist/i);
  // Catches: the Bring forward button saying anything but adding to the shortlist (for example "Send the request").
  await expect(sheet(page).locator("[data-sheet-confirm]")).toHaveText(ACTIONS.sheets.bringForward.confirm);
  await sheet(page).locator("[data-sheet-confirm]").click();
  // Catches: a Bring forward line left looking undone after the pick was added.
  await expect(line).toHaveAttribute("data-done", "true");
  // Catches: a confirmation that says Sent for something only added.
  await expect(line.locator("[data-brief-done]")).toHaveText(ACTIONS.sheets.bringForward.done);
  // Catches: Added on the brief with nothing on the shortlist: the Matches tab never hears of it.
  await openTab(page, speedrunCopy.network.tabs.matches);
  await expect(page.locator('[data-row-bring-forward][aria-pressed="true"]')).toHaveCount(1);
  await page.locator('[data-row-bring-forward][aria-pressed="true"]').click();
  // Catches: the Matches toggle not taking the pick off, which would leave the brief check below proving nothing.
  await expect(page.locator('[data-row-bring-forward][aria-pressed="true"]')).toHaveCount(0);
  await openTab(page, speedrunCopy.network.tabs.brief);
  // Catches: the brief still saying Added after the pick was taken off the shortlist.
  await expect(lines(page).first()).toHaveAttribute("data-done", "false");
  // Catches: the line going undone but with no Bring forward button to do it again.
  await expect(lines(page).first().locator("[data-brief-action]")).toHaveText(ACTIONS.briefButtons.bringForward);
});

test("brief action: a booked call is worded like the offered times, with no time zone", async ({ page }) => {
  await pinToday(page);
  await joinAs(page, "sam");
  await lines(page).nth(2).locator("[data-brief-action]").click();
  const meeting = DETAILS.sam!["Cindermoor Cloud"].meeting!;
  // Catches: the call read in a different format from the slots ("PM UTC" beside "10:00 am").
  await expect(sheet(page).locator("[data-sheet-meeting]")).toHaveText(whenLabel(meeting.at));
});

test("brief action: Every morning is a labelled setting, and the channel pills are tall enough to tap", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  const label = page.locator("[data-brief-cadence-label]");
  // Catches: the orphan line, a setting value with no label.
  await expect(label).toHaveText(COPY.cadenceLabel);
  await expect(page.locator("[data-brief-cadence]")).toHaveText(COPY.cadence.daily);
  // Catches: the label sitting below its value instead of naming it.
  const [labelBox, valueBox] = await Promise.all([label.boundingBox(), page.locator("[data-brief-cadence]").boundingBox()]);
  expect(labelBox!.y).toBeLessThan(valueBox!.y);
  // Catches: channel pills under the 44 px touch size (Ruling 68).
  for (const box of await page.locator("[data-channel]").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
});

test("brief action: at 1440 the email keeps a readable measure on the shared left edge", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await joinAs(page, "sam");
  const [email, heading] = await Promise.all([page.locator("[data-brief-email]").boundingBox(), page.locator("#sr-brief-heading").boundingBox()]);
  // Catches: the brief email growing past 36rem (576px) and stretching its lines past about 75 characters.
  expect(email!.width).toBeLessThanOrEqual(576);
  // Catches: the capped email centred or indented away from the heading's left edge.
  expect(Math.abs(email!.x - heading!.x)).toBeLessThanOrEqual(1);
});

test("brief action: on a phone the sheet is full width, every control is 44 px and nothing hides under the dock", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await joinAs(page, "sam");
  const opener = lines(page).nth(1).locator("[data-brief-action]");
  // Catches: a brief line's button under the 44 px touch size (Ruling 68).
  expect((await opener.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await opener.click();
  await expect(sheet(page)).toBeVisible();
  const box = (await sheet(page).boundingBox())!;
  // Catches: a sheet narrower than 343 px at a 375 viewport.
  expect(box.width).toBeGreaterThanOrEqual(343);
  // Catches: a sheet taller than the screen, whose confirm button is out of reach.
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
  // Catches: a control under the 44 px touch size in either direction.
  const sizes = await sheet(page).locator("button, a").evaluateAll((els) => els.map((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]));
  expect(sizes.length).toBeGreaterThanOrEqual(2);
  for (const [width, height] of sizes) {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  }
  // Catches: the bottom dock drawn over the sheet's lower edge.
  const bottomHit = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("dialog[data-action-sheet]"), { x: box.x + box.width / 2, y: box.y + box.height - 3 });
  expect(bottomHit).toBe(true);
  // Catches: the confirm button scrolled out of the sheet's own view.
  await sheet(page).locator("[data-sheet-confirm]").scrollIntoViewIfNeeded();
  await expect(sheet(page).locator("[data-sheet-confirm]")).toBeInViewport();
});

test("brief action: under reduced motion the sheet opens with no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await joinAs(page, "sam");
  await lines(page).first().locator("[data-brief-action]").click();
  await expect(sheet(page)).toBeVisible();
  // Catches: the sheet animating in for someone who asked for less motion.
  expect(await sheet(page).evaluate((el) => el.getAnimations().length)).toBe(0);
});
