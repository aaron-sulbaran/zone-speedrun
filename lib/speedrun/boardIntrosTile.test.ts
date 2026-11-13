import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Board } from "@/components/speedrun/act2/Board";
import { introCards } from "./actions";
import { classifyEmail } from "./classify";
import { initialDemoState } from "./demoState";
import { DETAILS } from "./details";
import { generateInbox, INBOX_TODAY } from "./inbox";
import { PEOPLE } from "./people";

// The sample inbox holds one intro email per company, so a second one from a company that already has a card is added here.
vi.mock("./inbox", async (original) => {
  const real = await original<typeof import("./inbox")>();
  const { classifyEmail: classify } = await import("./classify");
  return {
    ...real,
    generateInbox: (...args: Parameters<typeof real.generateInbox>) => {
      const emails = real.generateInbox(...args);
      const intro = emails.find((email) => classify(email).kind === "intro");
      return intro ? [...emails, { ...intro, id: `${intro.id}-again` }] : emails;
    },
  };
});

describe("the Board's Intros tile", () => {
  it("counts the warm intro cards, not the intro emails", () => {
    const events = generateInbox(PEOPLE.sam).map(classifyEmail);
    const emails = events.filter((event) => event.kind === "intro").length;
    const cards = introCards(events, null, DETAILS.sam, INBOX_TODAY).length;
    // Catches: a fixture where emails and cards agree, which could not tell the original bug from the fix.
    expect(emails).toBeGreaterThan(cards);
    const html = renderToStaticMarkup(createElement(Board, { state: { ...initialDemoState({ reading: false, email: false }), step: "ready", personKey: "sam", inboxConnected: true }, dispatch: () => {}, onTab: () => {} }));
    // Catches: a tile number that is not the count of cards beside it.
    expect(html).toContain(`data-stat="intros" data-value="${cards}"`);
  });
});
