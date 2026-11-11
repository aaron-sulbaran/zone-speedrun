# Splits product round (PR 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Act 2 into a product where every surface ends in a one-tap action, and give the desktop shell the design time it missed.

**Architecture:** All new behaviour is pure functions in `lib/speedrun/`: the intro request, the actions model and Sam's details. One reducer (`DemoState`) holds the shortlist, the intro request and the done set, so the brief and the board share them. One `ActionSheet` component renders every action's pre-filled content. Components stay presentational and under about 200 lines each.

**Tech Stack:** Next.js 16.2 (basePath `/speedrun`), React 19.2, TypeScript strict, Tailwind 3.4 over `sr-*` tokens, Web Animations through `lib/speedrun/motion.ts`, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-splits-product-round-design.md`, Rulings 36 to 69 plus its "Settled after the builder check" section. The intro request contract is the recruiter spec's Ruling 70 (`feat/splits-recruiter`, `docs/superpowers/specs/2026-11-11-splits-recruiter-view-design.md`).

## Global Constraints

- Tokens only: `sr-*` inside `[data-speedrun]`; never a hex in a component; `bg-x/NN` does nothing on `var()` colours.
- All copy lives in `lib/content/speedrun.ts`. Every new line is a draft from Aaron's words, and the PR lists them as drafts. No em dashes anywhere: copy, comments, commits.
- Components stay under about 200 lines. Pure logic goes in `lib/speedrun/` with vitest beside it.
- Every new or changed e2e assertion carries a `// Catches:` comment and is shown red first, with the log saved.
- Reduced motion is respected: sheets and drop-downs open without animation under it.
- Real links only where real:
  - Apply uses the snapshot role URL;
  - LinkedIn is `https://www.linkedin.com/in/aaron-sulbaran/`, from `lib/content.ts` socials;
  - X renders only when an X entry exists there.
- Phones: the shell is unchanged below lg. Content stacks. No sideways page scroll at 375 or 390. The table may scroll sideways inside its own container.
- Playwright runs only through `scripts/pwslot.sh`, in the foreground, one command at a time, with `E2E_PORT` set to the task's port. Never touch ports 3220, 3221, 3276, 3277, 3290, 3295 or 3296.
- Read and brief stay switched off. Nothing new calls the network.

## Review Focus

1. **A visitor with no inbox and no sample person** (their own answers, or a file read that failed) opens the Board. It shows "Your board", the shortlist, the live request and Tools, plus one line pointing to Connect and Matches. No crash, no empty tiles. Task 6a.
2. **Reordering after a request:** the request stays on its match (bound by `matchKey`), and the swap is refused once the status has left `requested`. Task 1.
3. **A rebuild:** Start over, picking another person, or a new upload clears the shortlist, the request and the done set, so no stale action points at a match that no longer exists. Task 1.
4. **Keyboard:**
   - a sheet takes focus on open, traps Tab, closes on Escape and returns focus to its opener;
   - sortable headers work from the keyboard and set `aria-sort`;
   - drop-downs report `aria-expanded`.

   Task 5 for the sheet, Task 6a for the table and tiles.
5. **Phones at 375:** the table scrolls inside its container, the page never scrolls sideways, sheets run full width, and nothing hides under the bottom dock. Task 8.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/speedrun/introRequest.ts` | Create | The Ruling 70 type, `createRequest`, `swapRequest`, `pass` |
| `lib/speedrun/demoState.ts` | Modify | Add `shortlist`, `introRequest`, `done`; remove `boardOrder`, `hidden`, `moveCard`, `toggleCard` |
| `lib/speedrun/inbox.ts` | Modify | Sam's pinned extra events (`PINNED`) |
| `lib/speedrun/details.ts` | Create | Sam's people, times, deadlines, prep and intro statuses |
| `lib/speedrun/actions.ts` | Create | The `Action` model: `needsYou`, `rowAction`, `todayActions`, `introCards`, `briefAction` |
| `lib/speedrun/brief.ts` | Modify | `BriefItem` gains `company` and `actionKey` |
| `components/speedrun/shell/*`, `act2/NetworkTabs.tsx` | Modify | The desktop shell |
| `components/speedrun/act2/Match*.tsx`, `Matches.tsx` | Modify | Two panes, bring forward, the intro request |
| `components/speedrun/act2/ActionSheet.tsx` | Create | One sheet for every action |
| `components/speedrun/act2/Board*.tsx`, `EventCards.tsx` | Modify or split | The new board |
| `components/speedrun/act2/NeedsYou.tsx`, `Shortlist.tsx`, `WarmIntros.tsx`, `TodayList.tsx` | Create | Board sections |
| `components/speedrun/act2/PasteEmail.tsx`, `BoardControls.tsx` | Delete | Rulings 54 and 55 |
| `components/speedrun/act2/BriefPreview.tsx`, `Decisions.tsx` | Modify | Brief actions, Why I built this |
| `lib/content/speedrun.ts` | Modify | All copy |

---

### Task 1: State and the intro request

**Files:**
- Create: `lib/speedrun/introRequest.ts`, `lib/speedrun/introRequest.test.ts`
- Modify: `lib/speedrun/demoState.ts`, `lib/speedrun/demoState.test.ts`, plus every consumer of `boardOrder`, `hidden`, `moveCard` and `toggleCard` (grep). Point `Board.tsx` at a fixed order for now; Task 6 rebuilds it.

**Interfaces:**
- Produces:
  ```ts
  // introRequest.ts
  export type IntroStatus = "requested" | "withFounder" | "connected" | "passed";
  export type IntroRequest = {
    candidate: { firstName: string; headline: string; shipped: string[]; kind: "visitor" | "sample" };
    match: Match;
    matchKey: string;
    ranked: string[]; // matchKeys, the request's first
    fit: { whyThem: string; whyRole: string };
    status: IntroStatus;
    introSent: boolean;
    passedBy: "team" | "founder" | null;
  };
  export function eligible(match: Match): boolean; // match.connect includes "intro"
  export function createRequest(input: { candidate: IntroRequest["candidate"]; shortlist: Match[]; intake: Intake }): IntroRequest | null; // #1 only, null if #1 is not eligible
  export function swapRequest(request: IntroRequest, to: Match, shortlist: Match[], intake: Intake): IntroRequest | null; // null unless status is "requested" and `to` is eligible
  export function pass(request: IntroRequest, by: "team" | "founder", shortlist: Match[], intake: Intake): { passed: IntroRequest; live: IntroRequest | null };
  // demoState.ts
  DemoState gains: shortlist: string[]; introRequest: IntroRequest | null; done: string[];
  DemoAction gains:
    | { type: "bringForward"; key: string; on: boolean }
    | { type: "moveShortlist"; key: string; direction: -1 | 1 }
    | { type: "requestIntro"; request: IntroRequest }
    | { type: "swapIntro"; request: IntroRequest }
    | { type: "markDone"; id: string };
  ```
  - `fit.whyThem` is `match.reasons[0].text`, or the company blurb.
  - `fit.whyRole` is the intake's `why`, or `""`.
  - Bringing forward a key that's already there is a no-op.
  - Removing the requested match's key from the shortlist clears `introRequest`.

- [ ] **Step 1: Write the failing tests.** In `introRequest.test.ts`:
  - `createRequest` refuses a non-eligible #1;
  - it builds `ranked` with the request's key first;
  - `swapRequest` returns null when the status is `withFounder`;
  - `pass` makes the next eligible match in `ranked` live at `requested`, and returns `live: null` when there's none.

  In `demoState.test.ts`:
  - `bringForward` adds once;
  - `moveShortlist` reorders and leaves `introRequest.matchKey` unchanged;
  - `pickPerson`, `built` and `reset` clear `shortlist`, `introRequest` and `done` (Review Focus 3);
  - `markDone` is idempotent;
  - `boardOrder`, `hidden`, `moveCard` and `toggleCard` no longer exist (a type-level test with `@ts-expect-error`).
- [ ] **Step 2: Run the tests.** Run `pnpm test lib/speedrun/introRequest.test.ts lib/speedrun/demoState.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the module and the reducer changes. Remove the board-order state and its consumers; the Board renders a fixed order until Task 6.
- [ ] **Step 4: Run the checks.** Run `pnpm test`, then `pnpm tsc --noEmit`, then `pnpm lint`. Expected: all pass. e2e tests that pinned arrange controls are deleted here, each named in the commit message.
- [ ] **Step 5: Commit** as `feat(state): shortlist, intro request (Ruling 70) and done set; arrange state removed`.

### Task 2: Sam's details and the actions model

**Files:**
- Modify: `lib/speedrun/inbox.ts`, `lib/speedrun/inbox.test.ts`
- Create: `lib/speedrun/details.ts`, `lib/speedrun/actions.ts`, `lib/speedrun/actions.test.ts`

**Interfaces:**
- Consumes: `Pipeline`, `AppRow`, `InboxEvent`, `INBOX_TODAY`, `IntroRequest`.
- Produces:
  ```ts
  // inbox.ts: fixed events for Sam, added the way OVERNIGHT adds moves, without touching the seeded generator
  export const PINNED: Partial<Record<PersonKey, PinnedEvent[]>>;
  // details.ts
  export type Contact = { name: "Aaron Sulbaran"; title: string };
  export type CompanyDetail = { contact: Contact; due?: string /* ISO */; meeting?: { at: string; link: string }; prep?: string[]; site?: string; introStatus?: "requested" | "replied" | "scheduled" | "waiting" };
  export const DETAILS: Partial<Record<PersonKey, Record<string /* company */, CompanyDetail>>>;
  // actions.ts
  export type ActionKind = "decideOffer" | "pickTime" | "replyTimes" | "confirmInterview" | "prepare" | "finishAssessment" | "finishApplication" | "followUp" | "joinMeeting" | "bringForward" | "apply";
  export type Action = { id: string; kind: ActionKind; company: string; role: string | null; who: Contact | null; due: string | null; quietDays: number | null; label: string; sheet: SheetContent };
  export type SheetContent = { title: string; draft?: string; slots?: string[]; prep?: string[]; links?: { label: string; href: string }[]; confirm: string; note: string };
  export function needsYou(pipeline: Pipeline, details: Record<string, CompanyDetail> | undefined, today: string): Action[]; // at most 4
  export function rowAction(row: AppRow, details: Record<string, CompanyDetail> | undefined, today: string): Action | null;
  export function todayActions(events: InboxEvent[], details: Record<string, CompanyDetail> | undefined, today: string): Action[];
  export function introCards(events: InboxEvent[], request: IntroRequest | null, details: Record<string, CompanyDetail> | undefined, today: string): IntroCard[];
  export type IntroCard = { company: string; who: Contact; status: "requested" | "withFounder" | "connected" | "replied" | "scheduled" | "waiting"; action: Action | null };
  ```
  - **Ids** are stable: ``${kind}:${company}:${role ?? "-"}``, so the brief and the board share them.
  - **Windows:**
    - an application at screen or later, quiet for 7 days: `followUp`;
    - an intro, quiet for 5 days: `followUp`;
    - "this week" is the next 6 days after `today`.
  - **Ranking:** by `due` ascending. Without a due date, rank by stage (offer, interview, assessment, screen, quiet), then by `lastEventAt`.
  - **Sam's pinned set:**
    - two offers with deadlines;
    - one application quiet past 7 days;
    - a min/Max intro at `scheduled`;
    - plus the existing Lumora Health (`replied`), Tarnmoor screen and Cindermoor interview, all with `DETAILS` entries.

    Every contact is "Aaron Sulbaran" with a per-company title.

- [ ] **Step 1: Write the failing tests.** In `actions.test.ts`:
  - Sam's `needsYou` at `INBOX_TODAY` returns exactly 4 actions;
  - the first is the soonest due offer;
  - every action has a non-empty `sheet.confirm`;
  - a generic person (`ravi`) gets labels from the stage map with `who: null` and `quietDays` set when there's no due date;
  - ids are stable across two calls;
  - `introCards` puts the live request first, with status `requested`.

  In `inbox.test.ts`: Sam's pinned events land, and other people's inboxes are byte-identical to before.
- [ ] **Step 2: Run the tests.** Run `pnpm test lib/speedrun/actions.test.ts lib/speedrun/inbox.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files. The copy for labels and sheets comes from `lib/content/speedrun.ts` under a new `actions` key.
- [ ] **Step 4: Run the checks.** Run `pnpm test`, then `pnpm tsc --noEmit`. Expected: pass. Count tests that changed because of Sam's extra events are updated, each named in the commit.
- [ ] **Step 5: Commit** as `feat(actions): Sam's pinned details and one actions model for board and brief`.

### Task 3: The desktop shell

**Files:**
- Modify: `components/speedrun/shell/AppShell.tsx`, `TopBar.tsx`, `AccountMenu.tsx` (position only), `components/speedrun/act2/NetworkTabs.tsx`, `components/speedrun/phases/NetworkPhase.tsx` (the Next link, the panel width), `e2e/speedrun.spec.ts` or `speedrun-board.spec.ts` (shell pins). E2E_PORT 3313.

**Interfaces:**
- Produces:
  - the element `[data-shell-switch-slot]`, empty and fixed width, immediately left of the avatar from lg up;
  - `NEXT_LINK`, the class for the Next text link, replacing `NEXT_BUTTON` everywhere.

Rulings 36 to 41, from lg up:
- one row with the site logo: `pt-20` drops at lg, and the bar's left padding clears the fixed logo;
- text tabs, left after the badge: `sr-ink2`, and the selected one `sr-ink` with a 2 px underline, no fills;
- the avatar at the bar's right edge;
- one max width shared by the bar's inner edge and every panel;
- Next as a text link;
- the Matches detail pane sticky at full list height, and the selected row with an ink border and the solid surface (unselected rows take the HUD tone).

Below lg, nothing changes.

- [ ] **Step 1: Write the failing e2e** at 1440x900 and 1280x800, on Sam's network phase:
  - the avatar's right edge is within 32 px of the bar's right edge (`// Catches:` the avatar between the badge and the tabs);
  - the selected tab's computed background is transparent and its `border-bottom-width` is 2px (`// Catches:` pill tabs);
  - the panels' content left edges are equal across all four tabs, within 1 px (`// Catches:` three content widths);
  - the Next control's background isn't `sr-ink` (`// Catches:` Next looks like the selected tab);
  - the Matches detail pane's bottom is within 2 px of the list column's bottom (`// Catches:` the short detail card);
  - the top bar's top is under 40 px (`// Catches:` the 80 px logo band).

  At 390: the dock is unchanged (`[role=tablist]` at the bottom).
- [ ] **Step 2: Run it red.** Run `scripts/pwslot.sh "$PWD" <log> env CI=1 E2E_PORT=3313 pnpm exec playwright test -g "desktop shell"`. Expected: FAIL. Save the log.
- [ ] **Step 3: Implement** the shell changes.
- [ ] **Step 4: Run it green, plus the existing shell and tab pins** (`-g "shell|tab|landscape"`). Expected: pass. Update any pin that encoded the old pills, naming it in the commit message.
- [ ] **Step 5: Commit** as `feat(shell): desktop top bar, text tabs, avatar top right, one width (Rulings 36 to 41)`.

### Task 4: Matches: bring forward, rank, one intro

**Files:**
- Modify: `components/speedrun/act2/Matches.tsx`, `MatchDetail.tsx`, `MatchList.tsx`, `MatchCard.tsx`, `NetworkPhase.tsx` (pass `state` and `dispatch` to Matches), `lib/content/speedrun.ts`, `e2e/speedrun-matches.spec.ts`. E2E_PORT 3314.

**Interfaces:**
- Consumes:
  - `eligible`, `createRequest` and `swapRequest` from Task 1;
  - the actions `bringForward`, `requestIntro` and `swapIntro`.
- Produces:
  - `data-bring-forward` on the toggle, with `aria-pressed`;
  - `data-request-intro` on the request button;
  - `data-intro-on` on the line that names where the request sits.

Behaviour (Rulings 42 to 44): the request button is enabled only on shortlist #1, only when it's eligible, and only with no live request. Every other match shows the line "Your intro request is on {company}". While the request is `requested`, a "Move my request here" button swaps it, and the swap moves that match to #1. Today's "Ask for a warm intro" sheet is gone. Apply and Follow stay.

- [ ] **Step 1: Write the failing e2e:**
  - bringing two matches forward and requesting on #1 sets `data-intro-on` on the other match (`// Catches:` more than one live request);
  - the request button is disabled on #2 (`// Catches:` requests on any pick);
  - "Move my request here" on #2 makes it #1 and moves the line (`// Catches:` a swap that leaves the rank);
  - Start over clears it all (Review Focus 3).
- [ ] **Step 2: Run it red** (`-g "bring forward|intro request"`). Expected: FAIL.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run it green, plus the existing matches spec file.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(matches): bring forward, rank and one intro request on #1 (Rulings 42 to 45)`.

### Task 5: ActionSheet and the brief's actions

**Files:**
- Create: `components/speedrun/act2/ActionSheet.tsx`
- Modify: `lib/speedrun/brief.ts` (and its test), `components/speedrun/act2/BriefPreview.tsx`, `BriefSend.tsx` only if the email render needs `actionKey`, `lib/content/speedrun.ts`, `e2e/speedrun-brief.spec.ts`. E2E_PORT 3315.

**Interfaces:**
- Consumes: `Action`, `SheetContent`, `briefAction` from Task 2; `markDone`; `state.done`.
- Produces:
  ```ts
  export function ActionSheet(props: { action: Action | null; onConfirm: (id: string) => void; onClose: () => void }): JSX.Element | null;
  // brief.ts
  export type BriefItem = { kind: "reply" | "new-role" | "due" | "intro"; text: string; href: string | null; standing?: boolean; company: string | null; actionKey: string | null };
  export function briefAction(item: BriefItem, pipeline: Pipeline, details: Record<string, CompanyDetail> | undefined, today: string): Action | null; // in actions.ts, from the row's stage, never from item.text
  ```
- **The sheet:**
  - a modal dialog through the project's modal pattern (body scroll lock, Portal to `document.body`);
  - it shows "Splits drafted this", the draft, the slots or the prep, and a note that the demo sends nothing;
  - one primary button runs `onConfirm`, which dispatches `markDone`;
  - the confirmed line shows a quiet check and dims, and stays in place.
- **Fix the orphan "Every morning"** as a labelled setting (Ruling 59).

- [ ] **Step 1: Write the failing tests:**
  - vitest: `briefAction` maps an interview line to `confirmInterview`, and a new-role line to `bringForward`;
  - vitest: `composeBrief` items carry `company` and `actionKey`;
  - e2e: on Sam's brief, every line has a button (`// Catches:` dead brief lines);
  - e2e: confirming "Pick a time" marks the line done, and the board's needs-you count drops by one (`// Catches:` brief and board out of sync);
  - e2e: the sheet traps Tab, closes on Escape and returns focus to its opener (Review Focus 4).
- [ ] **Step 2: Run them red.** Run `pnpm test lib/speedrun/brief.test.ts`, then pwslot `-g "brief action"`. Expected: FAIL.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run them green, plus the brief spec file and `pnpm test`.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(brief): one-tap actions through one ActionSheet (Rulings 56 to 60)`.

### Task 6a: The board's top: needs you, tiles, chart, table

**Files:**
- Modify: `components/speedrun/act2/Board.tsx`, `BoardStats.tsx`, `BoardTable.tsx`, `lib/speedrun/board.ts` (sort and filter, pure, with tests)
- Create: `components/speedrun/act2/NeedsYou.tsx`
- Also: `lib/content/speedrun.ts`, `e2e/speedrun-board.spec.ts`. E2E_PORT 3316.

**Interfaces:**
- Consumes: `needsYou`, `rowAction`, `ActionSheet`, `state.done`.
- Produces:
  ```ts
  // board.ts
  export type BoardFilter = "all" | "inProcess" | "offers" | "intros" | "closed";
  export type SortKey = "company" | "role" | "stage" | "applied" | "lastUpdate" | "next";
  export function filterRows(rows: AppRow[], filter: BoardFilter): AppRow[];
  export function sortRows(rows: AppRow[], key: SortKey, dir: "asc" | "desc", actions: Map<string, Action>): AppRow[];
  ```
  - Default sort: the next due date ascending, then `lastEventAt` descending.
  - The "Settled" 7 mapping:
    - Applied is all;
    - In process is open rows at assessment or later;
    - Offers is open rows at offer;
    - Intros is founder-lane rows;
    - Closed is rejected plus no-reply.
  - The Applied cell shows a dash without an applied event.

**The layout** (Rulings 46 to 50):
- the heading "{Name}'s board" or "Your board", with the needs-you count;
- NeedsYou, up to 4 items, each a drop-down with a primary button that opens ActionSheet;
- the tiles as toggle buttons (`aria-expanded`, `aria-pressed`) that drop down to their companies and set the filter;
- FlowChart full layout under the tiles;
- the table with sortable headers (`aria-sort`), filter chips and Next-step action links.

With no inbox and no sample person, this whole top is replaced by one line pointing to Connect and Matches (Review Focus 1).

- [ ] **Step 1: Write the failing tests:**
  - vitest for `filterRows` and `sortRows`;
  - e2e at 1440 on Sam's board: the 4 needs-you items are above the fold, each with a company, a person and a button (`// Catches:` dead first glance);
  - e2e: pressing the Offers tile lists two companies with deadlines, and filters the table to 2 rows (`// Catches:` tiles that lead nowhere);
  - e2e: a header click sorts, and `aria-sort` flips (`// Catches:` static table);
  - e2e: a visitor with their own answers and no inbox sees "Your board" and the pointer line, with no tiles (Review Focus 1).
- [ ] **Step 2: Run them red** (`-g "board top|needs you|board table"`). Expected: FAIL.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run them green, plus the board spec file and `pnpm test`.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(board): needs you, opening tiles, chart under them, a dated sortable table (Rulings 46 to 50)`.

### Task 6b: The board's lower sections, and the removals

**Files:**
- Create: `components/speedrun/act2/TodayList.tsx`, `WarmIntros.tsx`, `Shortlist.tsx`
- Modify: `Board.tsx`, `lib/content/speedrun.ts`, `e2e/speedrun-board.spec.ts`
- Delete: `PasteEmail.tsx`, `BoardControls.tsx`, `EventCards.tsx` (once replaced), and their now-unused lib code (`parsePasted`, `readPaste`), only if nothing else imports them. E2E_PORT 3316.

**Interfaces:**
- Consumes: `todayActions`, `introCards`, `ActionSheet`, `moveShortlist`, `bringForward`, `state.introRequest`.
- Produces: `data-today-item`, `data-intro-card`, `data-shortlist-item` hooks.

Rulings 51 to 55:
- **Today:**
  - finish an application: the real URL or a sheet;
  - an interview: Join and Add to calendar, both opening the sheet with the mock meeting link and its note;
  - prep: a drop-down with three points and links.
- **Warm intros:**
  - company, "Aaron Sulbaran" with a monogram, his title there, LinkedIn, and X only if present;
  - a status chip with text;
  - the nudge action;
  - min/Max as one of them.
- **Shortlist:** ranked, with move up and move down buttons, the request's status on #1, an empty state pointing to Matches, and a link back to Matches.
- **Tools** stays, last.
- **Removed:** the paste box, the arrange toggle and the card controls.

- [ ] **Step 1: Write the failing e2e:**
  - the Cindermoor interview's Join opens a sheet that shows a meeting link and the "the real version opens Meet or Zoom" note (`// Catches:` dead Today item);
  - the min/Max intro card shows "Aaron Sulbaran", a LinkedIn link to the socials URL, and a status chip (`// Catches:` dead intro data);
  - moving shortlist #2 up makes it #1, and the request stays on its match (Review Focus 2);
  - there's no textarea in `[data-board]` and no Arrange button (`// Catches:` the paste box returning).
- [ ] **Step 2: Run it red.** Expected: FAIL.
- [ ] **Step 3: Implement** and delete.
- [ ] **Step 4: Run it green, plus the board spec file, `pnpm test`, `pnpm tsc --noEmit` and `pnpm lint`.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(board): Today, warm intros and the shortlist with actions; paste and arrange removed (Rulings 51 to 55)`.

### Task 7: Why I built this

**Files:**
- Modify: `lib/content/speedrun.ts` (`network.tabs.decisions`, `network.nextTo.brief`, `decisions`), `components/speedrun/act2/Decisions.tsx`, `e2e/speedrun.spec.ts`. E2E_PORT 3317.

Rulings 61 to 64:
- The tab and the Next link read "Why I built this".
- The refresher line sits above the decisions. Draft: "I've sent 84 applications this fall, and some of my friends have sent 400. Splits is the tool I wanted on the other side of that."
- **Cards kept:** the brief, AI suggests, inbox read-only, intros stay human, founders routed.
- **"The board arranges itself"** is replaced by "Every screen ends in a next step."
- **Added:** "One tap for the human.", "No pasting.", "One intro, your top pick."
- The close is unchanged.

- [ ] **Step 1: Write the failing e2e:**
  - the last tab's name is "Why I built this" (`// Catches:` the bare "Why");
  - the refresher sits above the first card;
  - no card titled "The board arranges itself."
- [ ] **Step 2: Run it red.** Expected: FAIL.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run it green.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(why): Why I built this, with a refresher and updated decisions (Rulings 61 to 64)`.

### Task 8: Phones, the full suite, and docs

**Files:**
- Modify: `e2e/speedrun-board.spec.ts` (phone pins), `AGENTS.md` Layer 2 (its own commit). E2E_PORT 3318.

**AGENTS.md Layer 2:**
- the board is no longer arrangeable;
- `DemoState` holds `shortlist`, `introRequest` and `done`;
- `introRequest.ts` is PR 7's contract module;
- the actions model is one module.

Update "Last verified".

- [ ] **Step 1: Write the failing phone pins** at 375x812 on Sam's board (Review Focus 5):
  - `document.documentElement.scrollWidth` equals 375;
  - the table's container has `overflow-x: auto`;
  - an open sheet's width is at least 343;
  - the last board section's bottom is above the dock's top when scrolled to the end.
- [ ] **Step 2: Run them and fix** anything red. Show at least one pin red first: drop the table's overflow container, run, restore.
- [ ] **Step 3: Run the full default suite** (no `-g`) through the slot script. Expected: all pass, 0 failed. Then `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint`.
- [ ] **Step 4: Commit the pins,** then the AGENTS.md edit on its own as `docs(agents): ...`.

---

## Handoff note (shift 1 to shift 2)

Shift 1 (session "Build the speedrun application page") ended at a milestone:
- PRs 4 and 5 merged and live (`f7ef696`, `4da502d`);
- this spec approved by Aaron ("Approve, build it", 2026-11-11);
- this plan written.

Shift 2 runs the plan with superpowers:subagent-driven-development, with Sonnet implementers and Opus reviewers. Visual judgment stays with the controller: check 1440 and 390 yourself after Tasks 3, 6a, 6b and 8.

**Where things are:**
- **Worktree:** `zone-speedrun/.claude/worktrees/product`, on branch `feat/splits-product`. The spec commits are pushed. Base `88f4ccb`; its tree equals main's `4da502d`.
- **Board:** https://claude.ai/artifact/7JmVMWmD6rLGMwPdKsK4ni. Write it in the same turn as every event. Read `answers` and `ideas` at each turn's start. Merges need Aaron's word typed in the merging session's chat.
- **Lead:** "Personal Site Lead Orchestrator" (`local_2d8302e7-12af-49b2-82f1-3d2fa0241ea2`) gates every PR at 390 and 1440 in Chromium, desktop WebKit and iPhone WebKit. Send it the head SHA when the PR is open.
- **Recruiter view:** session "Splits recruiter view: brainstorm with Aaron" (`local_5c9e5c9d-f00d-4d1c-ab0c-cade6c69260f`). Its spec is on `feat/splits-recruiter` (`b8166d9`, not pushed). PR 7 builds on PR 6 after PR 6 merges. The contract between them is Ruling 70.
- **Preview for Aaron:** `screen -dmS splits-round`, serving `pnpm start -p 3296 -H 0.0.0.0` from the worktree under review, at http://localhost:3296/speedrun.
  - To restart, kill the PID listening on 3296 first; quitting the screen leaves the server alive.
  - He's on a flight: no LAN phone access, so give him localhost.

**Still open with Aaron:**
- his X profile URL (without it, the intro cards link LinkedIn only);
- S8, analytics under /speedrun;
- the draft copy in this PR, which is his to edit.

**Lessons from shift 1:**
- Restarting a `screen` server means killing the PID on the port.
- Build failures from Google Fonts are transient: retry.
- The lead's gate finds layout regressions that Chromium-only pins miss, so measure positions, not just properties.
- Every new pin goes red first.
