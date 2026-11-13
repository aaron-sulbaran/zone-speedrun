import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Board } from "@/components/speedrun/act2/Board";
import { TilePanel } from "@/components/speedrun/act2/TilePanel";
import { speedrunCopy } from "@/lib/content";
import { WarmIntros } from "@/components/speedrun/act2/WarmIntros";
import { TodayList } from "@/components/speedrun/act2/TodayList";
import { introCards, todayItems } from "./actions";
import { getSnapshot } from "./snapshot";
import { classifyEmail } from "./classify";
import { initialDemoState, type DemoState } from "./demoState";
import { DETAILS } from "./details";
import { generateInbox, INBOX_TODAY } from "./inbox";
import { PEOPLE } from "./people";
import type { AppRow } from "./types";

// The empty board is only reachable in a browser through a live resume read, which the default test server does not allow,
// so the render itself is pinned here: the Board's server markup for each way a visitor can arrive.
const copy = speedrunCopy.board;
const render = (state: DemoState) => renderToStaticMarkup(createElement(Board, { state, dispatch: () => {}, onTab: () => {} }));
const own = initialDemoState({ reading: false, email: false });
const apos = (text: string) => text.replace(/'/g, "&#x27;");

describe("the Board with no inbox and no sample person", () => {
  const html = render(own);

  it("says Your board", () => {
    // Catches: a board that names someone else, or has no name at all.
    expect(html).toContain(copy.heading(null));
  });

  it("points to Connect and to Matches with two real buttons", () => {
    // Catches: a board with nothing to read and nothing to do.
    expect(html).toContain("data-board-empty");
    expect(html).toMatch(new RegExp(`<button[^>]*data-empty-connect[^>]*>${copy.empty.connect}</button>`));
    expect(html).toMatch(new RegExp(`<button[^>]*data-empty-matches[^>]*>${copy.empty.matches}</button>`));
  });

  it("draws no tiles, list, chart or table", () => {
    // Catches: empty tiles, a needs-you list, a chart or a table drawn over nothing.
    for (const marker of ["data-stat=", "data-needs-you", "data-needs-item", "data-board-flow", "data-board-table", "data-board-stats"]) expect(html).not.toContain(marker);
  });

  it("keeps both pointer buttons at least 44 px tall", () => {
    // Catches: a pointer line whose two links are too small to tap on a phone (Ruling 68).
    for (const marker of ["data-empty-connect", "data-empty-matches"]) expect(html).toMatch(new RegExp(`<button[^>]*${marker}[^>]*class="[^"]*min-h-11`));
  });

  it("has no paste box, and shows no Shortlist until it has a pick", () => {
    // Catches: the paste box returning on the empty board (Ruling 54).
    expect(html).not.toContain("<textarea");
    // Catches: an empty Shortlist drawn under a line that already points to Matches (fix 12).
    expect(html).not.toContain('data-board-section="shortlist"');
    // Catches: a Today section drawn over nothing.
    expect(html).not.toContain('data-board-section="today"');
    // Catches: a pick made on the empty board going missing from the Board.
    expect(render({ ...own, shortlist: ["x"] })).toContain('data-board-section="shortlist"');
  });

  it("with the inbox connected, the pointer line names Matches and no paste", () => {
    const connected = render({ ...own, inboxConnected: true });
    // Catches: the old "Paste an email below" line left behind with nothing below it.
    expect(connected).not.toContain("<textarea");
    expect(connected).toContain(apos(copy.empty.connectedBefore));
  });

  it("keeps Tools", () => {
    // Catches: Tools lost along with the rest of the top.
    expect(html).toContain("data-tools-list");
  });
});

describe("the Board for a sample person", () => {
  const sam: DemoState = { ...own, step: "ready", personKey: "sam" };

  it("keeps the empty Shortlist in connect mode, where nothing else points to Matches", () => {
    const html = render(sam);
    // Catches: the empty Shortlist hidden on every board but the full one, leaving connect mode without Ruling 53's empty state.
    expect(html).toContain('data-board-section="shortlist"');
    // Catches: the empty state drawn without its link to Matches, the one way forward it offers.
    expect(html).toContain(copy.shortlist.empty.link);
  });

  it("asks to connect before showing anything, under their name", () => {
    const html = render(sam);
    // Catches: a sample person's board that forgets whose it is.
    expect(html).toContain(apos(copy.heading("Sam")));
    expect(html).toContain("data-connect-prompt");
    expect(html).not.toContain("data-stat=");
  });

  it("shows the whole top once the inbox is connected", () => {
    const html = render({ ...sam, inboxConnected: true });
    // Catches: the count, the list, the tiles, the chart or the table missing from a connected board.
    expect(html).toContain(apos(copy.count(4)));
    expect((html.match(/data-needs-item=/g) ?? []).length).toBe(4);
    for (const marker of ['data-stat="applied"', 'data-stat="offers"', "data-board-flow", "data-board-table"]) expect(html).toContain(marker);
  });

  it("counts only the items still open and shows a calm line at zero", () => {
    const connected = { ...sam, inboxConnected: true };
    const ids = (html: string) => [...html.matchAll(/data-action-done="([^"]+)"/g)].map((match) => match[1]);
    const doneOne = render({ ...connected, done: ["decideOffer:Wrenfield:Founding Engineer"] });
    // Catches: a done item still counted, or removed from the list.
    expect(doneOne).toContain(apos(copy.count(3)));
    expect(ids(doneOne)).toContain("decideOffer:Wrenfield:Founding Engineer");
    expect((doneOne.match(/data-needs-item=/g) ?? []).length).toBe(4);
    const allDone = render({ ...connected, done: ["decideOffer:Wrenfield:Founding Engineer", "pickTime:Lumora Health:-", "confirmInterview:Cindermoor Cloud:Software Engineer, New Grad", "decideOffer:Quillbright:Software Engineer, Product"] });
    // Catches: a heading that says "0 things need you today" instead of a calm line.
    expect(allDone).toContain(apos(copy.allClear));
    expect(allDone).not.toContain("things need you");
  });
});

describe("the Board's Intros tile", () => {
  it("counts the warm intros it lists, which are cards, not the intro emails", () => {
    const events = generateInbox(PEOPLE.sam).map(classifyEmail);
    const cards = introCards(events, null, DETAILS.sam, INBOX_TODAY);
    const html = render({ ...own, step: "ready", personKey: "sam", inboxConnected: true });
    // Catches: a tile number that is not the length of the cards list beside it.
    expect(html).toContain(`data-stat="intros" data-value="${cards.length}"`);
    // Catches: a second intro email from one company becoming a second card (C4).
    const again = { emailId: "x-again", company: "Lumora Health", role: null, kind: "intro" as const, date: `${INBOX_TODAY}T08:00:00.000Z`, lane: "founder" as const };
    expect(introCards([...events, again], null, DETAILS.sam, INBOX_TODAY)).toHaveLength(cards.length);
  });
});

describe("a tile's list for a row with no application email", () => {
  const row: AppRow = { company: "Mossgate", role: "Engineer", lane: "jobs", furthest: "interview", exit: "open", appliedAt: null, lastEventAt: "2026-11-02T10:00:00.000Z", next: null };
  const html = renderToStaticMarkup(createElement(TilePanel, { tile: "applied", rows: [row], actions: new Map(), intros: [], isDone: () => false, pickedFor: () => undefined, onOpen: () => {} }));

  it("shows no Applied date, and says why", () => {
    // Catches: "Applied" followed by the date of the last email, which is not when the application went in.
    expect(html).not.toContain("Applied Nov");
    expect(html).toContain(copy.table.noApplied);
  });
});

describe("Warm intros with no cards", () => {
  const html = renderToStaticMarkup(createElement(WarmIntros, { cards: [], isDone: () => false, pickedFor: () => undefined, onOpen: () => {}, onMatches: () => {} }));

  it("points to the Matches tab with a real button, not to a place above", () => {
    // Catches: the old "from a match above" wording, which points at nothing on this tab (C2).
    expect(html).toContain(copy.intros.empty.before);
    expect(html).not.toContain("above");
    // Catches: an empty state with no way to get to Matches.
    expect(html).toMatch(new RegExp(`<button[^>]*>${copy.intros.empty.link}</button>`));
  });
});

describe("Today's prep drop-down", () => {
  const role = getSnapshot().roles[0];
  const event = { emailId: "t-1", company: role.company, role: role.title, kind: "interview" as const, date: `${INBOX_TODAY}T09:00:00.000Z`, lane: "jobs" as const };
  const items = todayItems([event], undefined, INBOX_TODAY);
  const html = renderToStaticMarkup(createElement(TodayList, { items, isDone: () => false, pickedFor: () => undefined, onOpen: () => {} }));

  it("lists exactly the sheet's points, for a row whose points are not the general ones", () => {
    // A pinned row: min/Max, two days before its call (the reference day), so its prep is its own.
    const day = INBOX_TODAY;
    const intro = { emailId: "t-2", company: "min/Max", role: null, kind: "intro" as const, date: `${day}T09:00:00.000Z`, lane: "founder" as const };
    const [pinned] = todayItems([intro], DETAILS.sam, day);
    const points = pinned.action.sheet.prep ?? [];
    // Catches: fixture drift that makes this a row with no prep, such as min/Max's intro status turning to replied (a pickTime row): no drop-down renders and the equality below compares [] to [].
    expect(pinned.action.kind).toBe("prepare");
    // Catches: a fixture whose points are the general ones, which could not tell the sheet's source from a constant.
    expect(points).not.toEqual(speedrunCopy.actions.defaultPrep);
    const markup = renderToStaticMarkup(createElement(TodayList, { items: [pinned], isDone: () => false, pickedFor: () => undefined, onOpen: () => {} }));
    const list = /<ul data-today-prep-points="[^>]*>(.*?)<\/ul>/.exec(markup)?.[1] ?? "";
    const shown = [...list.matchAll(/<li>(.*?)<\/li>/g)].map((match) => match[1]);
    // Catches: the drop-down reading prep from anywhere but the sheet, or adding or dropping a point (equality, not inclusion).
    expect(shown).toEqual(points.map(apos));
  });

  it("shows the role's snapshot posting as a real new-tab link", () => {
    // Catches: a prep item whose posting link is missing, or not opened safely in a new tab (Ruling 51).
    const anchor = html.slice(html.indexOf(`<a href="${role.url.replace(/&/g, "&amp;")}"`));
    expect(anchor.startsWith("<a href=")).toBe(true);
    expect(anchor.slice(0, anchor.indexOf(">"))).toContain('target="_blank" rel="noopener noreferrer"');
  });
});

describe("Today's day-of join row", () => {
  const day = "2026-11-09";
  const intro = { emailId: "t-3", company: "min/Max", role: null, kind: "intro" as const, date: `${day}T09:00:00.000Z`, lane: "founder" as const };
  const [item] = todayItems([intro], DETAILS.sam, day);
  const html = renderToStaticMarkup(createElement(TodayList, { items: [item], isDone: () => false, pickedFor: () => undefined, onOpen: () => {} }));

  it("shows the meeting time and no Due line", () => {
    // Catches: the call's time missing from its own row.
    expect(html).toContain("data-today-when");
    // Catches: a Due line next to the meeting time on a row that only has a call to join.
    expect(html).not.toContain("data-today-due");
  });
});
