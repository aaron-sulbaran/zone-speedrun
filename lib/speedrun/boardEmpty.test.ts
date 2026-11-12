import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Board } from "@/components/speedrun/act2/Board";
import { speedrunCopy } from "@/lib/content";
import { initialDemoState, type DemoState } from "./demoState";

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

  it("keeps Tools", () => {
    // Catches: Tools lost along with the rest of the top.
    expect(html).toContain("data-tools-list");
  });
});

describe("the Board for a sample person", () => {
  const sam: DemoState = { ...own, step: "ready", personKey: "sam" };

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
