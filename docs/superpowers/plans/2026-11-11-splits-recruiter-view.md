# Splits: the talent team's side (PR 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the talent team's desk behind a Candidate / Talent team switch. It walks the visitor's one intro request through compare, founder, connect and outcome, and narrates what Splits does at each step.

**Architecture:**
- **The request is one object in `DemoState`, owned by PR 6.** PR 7 adds three legal transitions to `lib/speedrun/introRequest.ts` and three reducer actions that apply them.
- **The desk's walk is one pure step function** (`deskStep` in `lib/speedrun/desk.ts`). It takes the desk state, the live request and an action, and returns the next desk state plus at most one effect on the request. An illegal action returns both unchanged, so no gate can be skipped.
- **The side (candidate or team) joins `PhaseState`.**
- **Components live in a new `components/speedrun/team/` folder** and stay presentational.

**Tech Stack:** Next.js 16.2 (basePath `/speedrun`), React 19.2, TypeScript strict, Tailwind 3.4 over `sr-*` tokens, Web Animations through `lib/speedrun/motion.ts`, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-splits-recruiter-view-design.md`, Rulings 70 to 81 and section 3. PR 6's spec and plan (`feat/splits-product`: `docs/superpowers/specs/2026-11-11-splits-product-round-design.md`, `docs/superpowers/plans/2026-11-11-splits-product-round.md`) define everything this plan consumes.

**Base:** this branch builds on PR 6. Start from PR 6's merge on `main`. If Aaron and the Builder agree to overlap the two PRs, start instead from a `feat/splits-product` commit that contains PR 6's Tasks 1, 3 and 4 (`introRequest.ts`, the shell slot, Matches). Either way, rebase `feat/splits-recruiter` onto that base before Task 1.

## Global Constraints

- **Tokens only:** `sr-*` inside `[data-speedrun]`. Never a hex in a component. `bg-x/NN` does nothing on `var()` colours.
- **Copy:**
  - All copy lives in `lib/content/speedrun.ts`, under a new `team` key, plus one card appended to `decisions.cards`.
  - Every new line is a draft for Aaron, and the PR body lists them as drafts. His two narration lines are quoted from the spec's Ruling 75 exactly.
  - No em dashes anywhere: copy, comments, commits.
- **Sample data** lives in `lib/speedrun/deskSamples.ts`, beside `fictional.ts`. Every sample company comes from `FICTIONAL_COMPANIES`, and founders are never named (Ruling 73).
- **Size:** components stay under about 200 lines. Pure logic goes in `lib/speedrun/` with vitest beside it.
- **e2e:**
  - Every new e2e assertion carries a `// Catches:` comment and is shown red first, with the log saved.
  - Playwright runs only through `scripts/pwslot.sh`, in the foreground, one command at a time, with `E2E_PORT` set to the task's port (3331 to 3336).
  - Never touch ports 3220, 3221, 3276, 3277, 3290, 3295, 3296 or 3313 to 3318.
- **Reduced motion:** no arrival motion, no typing and no slide. Every state renders in its end state.
- **e2e drives the candidate side through PR 6's hooks:** `data-row-bring-forward` on list rows, and `data-bring-forward`, `data-request-intro`, `data-swap-intro` and `data-intro-here` in the detail pane. Ineligible matches render no request button. If PR 6 left a helper for bringing forward and requesting in `e2e/speedrun-flow.ts`, use it; otherwise add `spendIntro(page, picks)` there once, in Task 4.
- **Nothing calls the network.** Read and brief stay switched off. "Send" buttons change state only.
- **Phones:**
  - no sideways page scroll at 320, 375 or 390;
  - the desk never scrolls the document; its panel scrolls inside the shell (Ruling 81, spec section 8);
  - every tap target is at least 44 by 44 (PR 6's Ruling 68 pin covers `[data-shell]`, and the desk sits inside it).

## Review Focus

1. **A rebuild mid-walk.** Start over, Replay from the top, picking another person or a new upload, with the desk mid-walk, returns to a clean candidate side. The next visit to the desk starts fresh, and no card points at a match that no longer exists. Task 3 (side), Task 5 (desk state).
2. **A swap from the candidate side while the desk is mid-walk.** While the request is `requested`, the candidate moves it to another match. On the desk, the visitor's card and an open compare drawer show the new match and its rivals, never the old one. Once the desk has sent it, the swap is refused, as PR 6 already pins. Task 5.
3. **No live request.** The visitor flips to the desk having spent nothing, or after a pass with no eligible next match. The nudge card shows, Review appears nowhere, and "Two weeks later" still reaches the finished sample. Tasks 2 and 4.
4. **Keyboard:**
   - the founder panel takes focus on open, traps Tab, closes on Escape without answering, and returns focus to the visitor's card;
   - the compare drawer moves focus to its heading, and Escape closes it;
   - the switch keeps focus when it flips.

   Tasks 3 and 5.
5. **320 wide.** Both switch labels show in full, the stage strip fits, the drawer and the founder panel run full width, and nothing hides under the dock (the dock is hidden on the team side). Task 6.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/speedrun/introRequest.ts` | Modify | Add `sendToFounder`, `founderYes`, `markIntroSent`; add `resolveShortlist` unless PR 6 has an equivalent |
| `lib/speedrun/demoState.ts` | Modify | Add `passed`; add actions `advanceIntro`, `sendIntro`, `passIntro`; guard `requestIntro` and `swapIntro` against passed keys |
| `lib/speedrun/deskSamples.ts` | Create | Sample cards, the finished sample, rivals per function, the learned lines |
| `lib/speedrun/desk.ts` | Create | `DeskState`, `deskStep`, `deskColumns`, `stageOf` |
| `lib/speedrun/phase.ts` | Modify | `side` in `PhaseState`, the `side` event |
| `components/speedrun/shell/SideSwitch.tsx` | Create | The Candidate / Talent team control |
| `components/speedrun/shell/TopBar.tsx`, `AppShell.tsx` | Modify | Host the switch; hide the tabs on the team side |
| `components/speedrun/phases/NetworkPhase.tsx` | Modify | Render the desk on the team side; hold the desk state |
| `components/speedrun/SpeedrunExperience.tsx` | Modify | Pass `side` and its setter down |
| `components/speedrun/team/Desk.tsx` | Create | The desk's layout and wiring |
| `components/speedrun/team/DeskBoard.tsx`, `DeskCard.tsx` | Create | Columns from md, the stage strip below md |
| `components/speedrun/team/Narration.tsx`, `ActingAs.tsx` | Create | The line above the board, the chip beside the actions |
| `components/speedrun/team/DeskPanel.tsx` | Create | The drawer, in three modes: compare, intro, sample |
| `components/speedrun/team/CompareDrawer.tsx`, `IntroDraft.tsx`, `FinishedSample.tsx` | Create | The drawer's three modes |
| `components/speedrun/team/FounderPanel.tsx` | Create | The one-pager and the ask, as a modal |
| `components/speedrun/team/LearnedStrip.tsx`, `FullVersion.tsx` | Create | The learning strip, and the "how a full version runs" disclosure |
| `components/speedrun/act2/MatchCard.tsx` (or wherever PR 6 renders "Request a warm intro") | Modify | The earned door (Ruling 72) |
| `lib/content/speedrun.ts` | Modify | `team` copy and one Why card |
| `e2e/speedrun-desk.spec.ts` | Create | Desk pins |
| `AGENTS.md` | Modify | Layer 2, in its own commit |

---

### Task 1: The request's transitions

**Files:**
- Modify: `lib/speedrun/introRequest.ts`, `lib/speedrun/introRequest.test.ts`, `lib/speedrun/demoState.ts`, `lib/speedrun/demoState.test.ts`.

**Interfaces:**
- Consumes (PR 6): `IntroRequest`, `IntroStatus`, `eligible`, `isLive(request)` (non-null and not `passed`), `pass(request, by, shortlist, intake)`, and `DemoState.shortlist`, `.introRequest`, `.result`, `.intake`.
- Produces:
  ```ts
  // introRequest.ts
  export function sendToFounder(r: IntroRequest): IntroRequest | null; // requested → withFounder, else null
  export function founderYes(r: IntroRequest): IntroRequest | null;    // withFounder → connected, else null
  export function markIntroSent(r: IntroRequest): IntroRequest | null; // connected && !introSent → introSent: true, else null
  export function resolveShortlist(result: MatchResult, keys: string[]): Match[]; // keys in order, unknown keys dropped (skip if PR 6 exports an equivalent; use theirs)
  // demoState.ts
  DemoState gains: passed: { key: string; by: "team" | "founder" }[];  // cleared by pickPerson, built and reset, as PR 6 clears shortlist
  DemoAction gains:
  | { type: "advanceIntro"; to: "withFounder" | "connected" }
  | { type: "sendIntro" }
  | { type: "passIntro"; by: "team" | "founder" }
  ```
  - **Each action applies its transition** to `state.introRequest`. A null result (illegal) leaves the state unchanged.
  - **These three are reducer cases of their own.** They never route through PR 6's `requestIntro` or `swapIntro`, which only apply while the request is `requested`, and only for shortlist keys (PR 6, Task 4).
  - **The live request is found by `introRequest.matchKey`, never by shortlist position.** PR 6's `moveShortlist` can lift another pick above it.
  - **`passIntro`:**
    - It appends `{ key: introRequest.matchKey, by }` to `passed`.
    - It calls PR 6's `pass` with `resolveShortlist(state.result, state.shortlist.filter(key => !passed.some(p => p.key === key)))`, with the new entry included, and `state.intake`. PR 6's `pass` already skips keys that are ineligible or gone from the shortlist; filtering `passed` out first stops it handing the request back to a match already passed. PR 6's Task 4 re-syncs `ranked` from the shortlist and doesn't know about passes.
    - It stores `live` as the new `introRequest`.
    - With a live request, it moves the live key to `shortlist[0]`, as `swapIntro` does. The passed match stays in the shortlist.
    - The passed request isn't kept: the desk shows only the live one.
  - **PR 6's `requestIntro` and `swapIntro` gain one guard:** they refuse a key that's in `passed`. A candidate can't put the request back on a match the team or the founder already passed. PR 6's own guard uses `isLive(request)` (non-null and not `passed`), and its Matches slot (`lib/speedrun/introSlot.ts`) doesn't know about passes. This guard is what stops a passed key, and Task 6 teaches the slot.
  - **The request is locked once the desk moves it.** In PR 6, `bringForward` with `on: false` on the requested match withdraws the request at any status. PR 7 adds a guard: while the request is `withFounder` or `connected`, `bringForward` off on its key is a no-op (spec Ruling 70: a swap or withdrawal only while `requested`). At `requested`, PR 6's withdrawal stands.
  - **`resolveShortlist`** is new here: PR 6 has no equivalent (confirmed by the Builder at PR 6's `61552bb`).

- [ ] **Step 1: Write the failing tests.** In `introRequest.test.ts`:
  - `sendToFounder` moves `requested` to `withFounder`, and returns null from `withFounder`, `connected` and `passed`;
  - `founderYes` returns null from `requested` (gate 1 can't be skipped);
  - `markIntroSent` returns null when the request isn't `connected`, or when `introSent` is already true;
  - `resolveShortlist` keeps the order and drops unknown keys.

  In `demoState.test.ts`:
  - `advanceIntro` to `connected` from `requested` leaves the state unchanged;
  - after `advanceIntro` to `withFounder`, PR 6's `swapIntro` is refused;
  - `passIntro` with a shortlist of three eligible matches makes #2 live at `requested`, with `shortlist[0]` and `introRequest.ranked[0]` both equal to the new live key (`// Catches:` the request leaving #1, which PR 6's Matches can't show);
  - `passIntro` with no other eligible match sets `introRequest` to null;
  - `passIntro` works on a `withFounder` request, where PR 6's guarded `swapIntro` would refuse it (`// Catches:` a pass routed through the swap's guard);
  - with picks A, B and C, all eligible: pass A, then `moveShortlist` A up above B (PR 6's sync puts A back into `ranked`), then pass B. C is live, not A (`// Catches:` the request handed back to a passed match);
  - `swapIntro` and `requestIntro` onto a passed key are refused;
  - `moveShortlist` lifting another pick above the live request leaves `introRequest.matchKey` unchanged, and `passIntro` still passes that match, not `shortlist[0]`;
  - `pickPerson`, `built` and `reset` clear `passed`;
  - `bringForward` off on the requested key at `withFounder` leaves both the shortlist and `introRequest` unchanged, while at `requested` it still withdraws (`// Catches:` a candidate pulling a request the founder already holds).
- [ ] **Step 2: Run them.** Run `pnpm test lib/speedrun/introRequest.test.ts lib/speedrun/demoState.test.ts`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the transitions and the three reducer cases.
- [ ] **Step 4: Run the checks.** Run `pnpm test`, then `pnpm tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit** as `feat(intro): the desk's transitions on the intro request (Ruling 70)`.

### Task 2: The desk model and its sample data

**Files:**
- Create: `lib/speedrun/deskSamples.ts`, `lib/speedrun/deskSamples.test.ts`, `lib/speedrun/desk.ts`, `lib/speedrun/desk.test.ts`.

**Interfaces:**
- Consumes: `IntroRequest`, `Match`, `matchKey`, `FICTIONAL_COMPANIES`, `Fn`, the snapshot's companies (for the test).
- Produces:
  ```ts
  // deskSamples.ts
  export type DeskStage = "requested" | "withFounder" | "connected" | "tracking" | "outcome";
  export type SampleCard = { id: string; firstName: string; company: string; role: string; stage: DeskStage; pill: string };
  export const DESK_SAMPLES: SampleCard[];        // 9 cards: requested 2, withFounder 2, connected 1, tracking 2, outcome 2
  export type FinishedSample = { card: SampleCard; timeline: { label: string; when: string }[]; survey: { candidate: string; founder: string }; tag: "fitHit" };
  export const FINISHED_SAMPLE: FinishedSample;   // its card is one of the two outcome cards, pill "hired"
  export type Rival = { id: string; firstName: string; headline: string; whyThem: string; whyRole: string; project: string };
  export const RIVALS: Record<Fn | "default", Rival[]>; // at least 2 per key
  export function rivalsFor(match: Match): Rival[];      // 2 from RIVALS[match.role?.fn ?? "default"] (unknown fn → "default"), picked by a stable hash of matchKey(match)
  export const LEARNED: string[];                 // 3 lines, one of them a people miss marked "matching unchanged"
  export const LEARNED_FROM_SAMPLE: string;       // added once the walk reaches the finished sample
  // desk.ts
  export type Beat = "arrive" | "review" | "sent" | "sentInstead" | "interested" | "notNow" | "introSent" | "twoWeeks";
  export type DeskState = { beat: Beat; panel: null | "compare" | "intro" | "sample"; founderOpen: boolean; rivalSent: string | null; stage: DeskStage; sampleSeen: boolean; arrivedKey: string | null };
  export const INITIAL_DESK: DeskState;           // beat "arrive", panel null, stage "requested"
  export type DeskAction =
    | { type: "review" } | { type: "closePanel" } | { type: "openFounder" }
    | { type: "send" } | { type: "sendInstead"; rivalId: string }
    | { type: "founder"; yes: boolean } | { type: "sendIntro" } | { type: "twoWeeks" }
    | { type: "selectStage"; stage: DeskStage } | { type: "arrived"; key: string };
  export type IntroEffect = { type: "advance"; to: "withFounder" | "connected" } | { type: "sendIntro" } | { type: "pass"; by: "team" | "founder" };
  export function deskStep(desk: DeskState, request: IntroRequest | null, action: DeskAction): { desk: DeskState; effect: IntroEffect | null };
  export function stageOf(request: IntroRequest | null): DeskStage | null; // requested | withFounder | connected; null when null or passed
  export type DeskCard = SampleCard & { mine: boolean };
  export function deskColumns(request: IntroRequest | null, firstName: string): Record<DeskStage, DeskCard[]>; // the visitor's card first in its column
  ```

**`deskStep`'s legality table.** Any other combination returns `{ desk, effect: null }` unchanged.

| Action | Legal when | Effect | Desk after |
|---|---|---|---|
| `review` | status `requested` | none | panel `compare`, beat `review` |
| `send` | status `requested`, panel `compare` | `advance withFounder` | panel null, `founderOpen` true, beat `sent`, stage `withFounder` |
| `sendInstead` | status `requested`, panel `compare`, `rivalId` in `rivalsFor(match)` | `pass team` | panel null, `rivalSent` id, beat `sentInstead`, stage `requested` |
| `openFounder` | status `withFounder` | none | `founderOpen` true |
| `founder` yes | status `withFounder`, `founderOpen` | `advance connected` | `founderOpen` false, panel `intro`, beat `interested`, stage `connected` |
| `founder` no | status `withFounder`, `founderOpen` | `pass founder` | `founderOpen` false, panel null, beat `notNow`, stage `requested` |
| `sendIntro` | status `connected`, not `introSent` | `sendIntro` | panel `intro`, beat `introSent` |
| `twoWeeks` | request null, or `connected` with `introSent` | none | panel `sample`, beat `twoWeeks`, stage `outcome`, `sampleSeen` true |
| `closePanel` | always | none | panel null, `founderOpen` false |
| `selectStage` | always | none | stage set |
| `arrived` | always | none | `arrivedKey` set |

- [ ] **Step 1: Write the failing tests.** In `deskSamples.test.ts`:
  - every `DESK_SAMPLES` company and `FINISHED_SAMPLE.card.company` is in `FICTIONAL_COMPANIES`, and is not a company name in `snapshot.json` (`// Catches:` an invented outcome at a real company);
  - `rivalsFor` returns 2, returns the same 2 for the same match twice, and draws from the role's `fn` pool;
  - no rival id equals a `DESK_SAMPLES` id (rivals never become cards);
  - stage counts are 2, 2, 1, 2, 2.

  In `desk.test.ts`:
  - every row of the legality table, legal and illegal;
  - `founder` before `send` is refused, and so is `sendIntro` before `founder` yes (no gate skipped);
  - `twoWeeks` with a null request is legal (Review Focus 3);
  - `deskColumns` puts the visitor's card first in its stage, adds no visitor card for null or `passed`, and keeps every sample card.
- [ ] **Step 2: Run them.** Run `pnpm test lib/speedrun/desk.test.ts lib/speedrun/deskSamples.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
  - **Names:** sample first names are invented and varied.
  - **Rival lines:** each `whyThem` is written for its function (one line, a real-sounding project), with no company named.
  - **The finished sample's timeline:** intro, first chat, interviews, offer, hired, with relative times ("week 1", and so on).
  - **Its survey answers:** one line each side, both saying the match fit.
- [ ] **Step 4: Run the checks.** Run `pnpm test` and `pnpm tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit** as `feat(desk): the desk's step function and its sample data (Rulings 73, 74, 78, 79)`.

### Task 3: The switch and the side

**Files:**
- Modify: `lib/speedrun/phase.ts` and its test, `components/speedrun/SpeedrunExperience.tsx`, `components/speedrun/phases/NetworkPhase.tsx`, `components/speedrun/shell/TopBar.tsx`, `components/speedrun/shell/AppShell.tsx`, `lib/content/speedrun.ts`.
- Create: `components/speedrun/shell/SideSwitch.tsx`, `e2e/speedrun-desk.spec.ts`.
- E2E_PORT 3331.

**Interfaces:**
- Consumes: PR 6's `[data-shell-switch-slot]`.
- Produces:
  ```ts
  // phase.ts
  export type Side = "candidate" | "team";
  export type PhaseState = { phase: Phase; tab: NetworkTab; side: Side };
  // PhaseEvent gains: | { type: "side"; side: Side; tab?: NetworkTab }  (network phase only; tab optional, used by "back to Matches")
  // enterJoin, logDone, startOver and replayTop all set side "candidate".
  export function SideSwitch(props: { side: Side; onSide: (side: Side) => void }): JSX.Element;
  ```
  - **Data hooks:** `data-side-switch` on the control's group, `data-side` on `#act-2` while in the network phase, and `data-desk` on the desk's root.

**Behaviour** (Ruling 71):
- **The control:** a group of two buttons with `aria-pressed`, labelled `team.switch.candidate` ("Candidate") and `team.switch.team` ("Talent team"). The group's accessible name is `team.switch.label`.
- **Focus** stays on the pressed button after a flip.
- **Placement:**
  - from lg, it renders inside PR 6's slot;
  - from sm to lg, it sits in the top row, left of the avatar;
  - below sm, it takes its own full-width row under the bar, two equal halves, the same way the badge takes its row today.
- **On the team side:**
  - every tab panel stays mounted and hidden, so the candidate side returns exactly as left;
  - the tablist is hidden;
  - the desk renders in the main area (a heading-only placeholder in this task; Task 4 fills it).

- [ ] **Step 1: Write the failing tests.**
  - **vitest:**
    - `side` flips only in the network phase;
    - `startOver`, `replayTop` and `logDone` return `side: "candidate"` (Review Focus 1);
    - a `side` event with `tab: "matches"` sets both.
  - **e2e** on Sam's network phase:
    - from each of the four tabs, pressing Talent team shows `[data-desk]` and hides `[role=tablist]` (`// Catches:` a switch that only works from one tab);
    - pressing Candidate returns to the same tab, with the same match selected (`// Catches:` the candidate side resetting on a flip);
    - after a flip, `document.activeElement` is the pressed switch button (`// Catches:` focus dropped to body);
    - Start over from the team side, then a rebuild, lands on the candidate side (Review Focus 1);
    - at 320 by 640, both switch labels' `scrollWidth` is at most their `clientWidth`, and `document.documentElement.scrollWidth` is 320 (`// Catches:` a cut label, or a sideways scroll).
- [ ] **Step 2: Run them red.** Run `pnpm test lib/speedrun/phase.test.ts`, then `scripts/pwslot.sh "$PWD" <log> env CI=1 E2E_PORT=3331 pnpm exec playwright test e2e/speedrun-desk.spec.ts -g "switch"`. Expected: FAIL. Save the log.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run them green,** plus `-g "shell|tab"`. Expected: pass.
- [ ] **Step 5: Commit** as `feat(shell): the Candidate / Talent team switch (Ruling 71)`.

### Task 4: The desk's board

**Files:**
- Create: `components/speedrun/team/Desk.tsx`, `DeskBoard.tsx`, `DeskCard.tsx`, `Narration.tsx`, `ActingAs.tsx`, `LearnedStrip.tsx`, `FullVersion.tsx`.
- Modify: `NetworkPhase.tsx` (hold `useReducer` for the desk state, render `Desk`), `lib/content/speedrun.ts`, `e2e/speedrun-desk.spec.ts`.
- E2E_PORT 3332.

**Interfaces:**
- Consumes: `deskStep`, `deskColumns`, `INITIAL_DESK`, `stageOf`, `LEARNED`, `LEARNED_FROM_SAMPLE`, `state.introRequest`, and `visitorFirstName`.
- Produces:
  ```ts
  export function Desk(props: { state: DemoState; dispatch: Dispatch<DemoAction>; desk: DeskState; step: (a: DeskAction) => void; onSide: (side: Side, tab?: NetworkTab) => void }): JSX.Element;
  ```
  - **`step`** is defined in `NetworkPhase`. It runs `deskStep` and applies the desk result. It then maps any effect to a demo action:
    - `advance` → `advanceIntro`;
    - `sendIntro` → `sendIntro`;
    - `pass` → `passIntro`.
  - **Data hooks:**
    - `data-desk-column="{stage}"` with `data-count`;
    - `data-desk-card` with `data-mine`;
    - `data-narration`;
    - `data-acting-as`;
    - `data-learned`;
    - `data-full-version`;
    - `data-desk-nudge`.

**Layout,** top to bottom, in the shell's shared content width:

1. **The opening lines** (Ruling 80): the heading `team.heading` ("what this unlocks for the talent team"), then `team.intro`. Both are verbatim drafts from the spec.
2. **The narration line** (Ruling 75): `role="status"`, polite, in the build log's look, with the line for the current beat. The `arrive` beat reads `team.beats.arrive`, draft: "Your request just landed. Review it to see what the team sees." With no live request, it reads `team.beats.empty`, draft: "This is the team's queue. Spend your intro request to watch it land here."
3. **The acting-as chip:** `team.actingAs.team` ("You're acting as the talent team").
4. **The board:**
   - **From md:** five columns with headings from `team.stages` (Requested, With founder, Connected, Tracking, Outcome) and counts.
   - **Below md:** a stage strip of five pill buttons with counts (`aria-pressed`), above the one column in `desk.stage`.
   - **The visitor's card** has the ink border and `team.yours` ("Your request").
   - **Card buttons:** in Requested, the visitor's card carries Review; in With founder, it carries "Open the one-pager", which runs `openFounder`.
   - **With no live request,** Requested starts with the nudge card (Ruling 72): `team.nudge`, and a button `team.nudgeButton` that calls `onSide("candidate", "matches")`. A second button, `team.twoWeeks`, runs `twoWeeks` (the way out).
5. **The learned strip** (Ruling 79): `team.learnedHeading` ("What Splits learned this month") with the `team.sampleLabel` tag, the `LEARNED` lines, plus `LEARNED_FROM_SAMPLE` once `desk.sampleSeen`.
6. **The full-version disclosure:** a `<details>` with the summary `team.fullVersion.summary` ("How a full version would run"). It holds the spec's section 3 as a compact list: the 12 steps (who, then what) and the six "also in the complete version" notes. They're copied as drafts from the spec, in `team.fullVersion`. This is the loop visual Aaron asked to have on the page.

**Arrival:** on mount, when `stageOf(request) === "requested"` and `desk.arrivedKey !== request.matchKey`, the visitor's card plays the step enter (`motion()` `stepMs` and `stepPx`, `STEP_EASE`), then runs `arrived`. Under reduced motion, it runs `arrived` with no animation.

- [ ] **Step 1: Write the failing e2e** (Sam, request spent on #1 through PR 6's flow, then Talent team):
  - at 1440, five `[data-desk-column]` elements share one row, their `data-count` values sum to 10, and Requested's first card has `data-mine` (`// Catches:` the visitor's card missing, or out of place);
  - at 390, one column shows, and the stage strip has five buttons (`// Catches:` five squeezed columns on a phone);
  - at 1440 and 390, `document.documentElement.scrollHeight` equals the viewport height on the team side (`// Catches:` the desk scrolling the document);
  - with no request spent, `[data-desk-nudge]` shows, no Review button exists, and its Matches button lands on Matches with the switch on Candidate (Review Focus 3);
  - `[data-narration]` has `role="status"`, and `[data-full-version]` opens to 12 list items (`// Catches:` the loop visual dropped).
- [ ] **Step 2: Run it red** (`-g "desk board"`). Expected: FAIL.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run it green.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(desk): the board of stages, narration, learned strip and full-version list (Rulings 73, 75, 79, 80)`.

### Task 5: The walk

**Files:**
- Create: `components/speedrun/team/DeskPanel.tsx`, `CompareDrawer.tsx`, `IntroDraft.tsx`, `FinishedSample.tsx`, `FounderPanel.tsx`.
- Modify: `Desk.tsx`, `lib/content/speedrun.ts`, `e2e/speedrun-desk.spec.ts`.
- E2E_PORT 3333.

**Interfaces:**
- Consumes:
  - `rivalsFor`, `FINISHED_SAMPLE`, `step`;
  - `state.introRequest` (read on every render, never copied into desk state; Review Focus 2);
  - the repo's modal pattern: a native `<dialog>` opened with `showModal()`, as `components/speedrun/act2/Egg.tsx` does. That gives the top layer, the focus trap, Escape, an inert page and focus returned on close. Add a body scroll lock while it's open, as PR 6's `ActionSheet` does. If `ActionSheet` has landed on this branch's base with a shared hook for this, use it; otherwise follow `Egg.tsx` directly, and don't edit `ActionSheet`.
- Produces the data hooks `data-desk-panel="{mode}"`, `data-founder-panel`, `data-one-pager`, `data-intro-draft` and `data-finished-sample`.

**DeskPanel** is a non-modal drawer at the board's right edge from md, about 420 px wide, and full width below md. It moves focus to its heading on open, closes on Escape (`closePanel`), and scrolls inside itself.
- **compare** (Ruling 74): the visitor beside `rivalsFor(match)`. Each person shows:
  - `whyThem`, under `team.compare.whyThem`;
  - `whyRole`, under `team.compare.whyRole`;
  - their project, under `team.compare.project`;
  - their headline.

  For the visitor, the values come from `request.fit` and `request.candidate.shipped[0]`. Splits' suggestion carries the `team.compare.suggested` tag and the primary button `team.compare.send(name)` ("Send {name} to the founder"), which runs `send`. Each rival has `team.compare.sendInstead` ("Send instead"), which runs `sendInstead`.
- **intro** (Ruling 77):
  - **The header:** to `team.intro.toFounder(company)` ("the founder at {company}") and the candidate, with the talent team copied.
  - **The body:** `team.intro.body(name, company, role, whyThem)`, a short draft.
  - **The button:** "Send the intro" (`sendIntro`). Once sent, it reads `team.intro.sent` and a `team.twoWeeks` button ("Two weeks later") appears.
- **sample** (Ruling 78): `FinishedSample` shows `FINISHED_SAMPLE`'s timeline, both survey answers under `team.sample.surveyQuestion` ("Was it the match, or was it the people?"), and the tag `team.sample.fitHit`. It ends with `team.sample.end` ("That's the loop.") and a button `team.sample.back` that calls `onSide("candidate")`.

**FounderPanel** (Ruling 76) is a modal dialog through the sheet mechanics. It opens whenever `desk.founderOpen`, and the desk behind it dims.
- **The heading:** `team.founder.heading(company)`: "You're the founder now. This is what a founder at {company} would get."
- **The chip:** `team.actingAs.founder` ("You're acting as the founder").
- **The one-pager, in order:**
  - the name and headline;
  - the most relevant project (`shipped[0]`) and the rest of `shipped` as "their work";
  - link chips for LinkedIn, X and portfolio, all inert with `team.founder.linksNote`;
  - "Why Splits matched them", from `fit.whyThem` plus the match's other reason texts;
  - the ask, `team.founder.ask(name)`, with Yes and Not now (`founder`).
- **Empty fields:** an empty section is left out. The fit brief and the ask always render.
- **Names:** `name` is `candidate.firstName.trim()`, or `team.noName` ("this candidate").
- **Escape** runs `closePanel` and returns focus to the visitor's card.
- **Links:** no resume text reaches client state, and the sample resumes carry no URLs, so every chip is inert in this PR. The spec's "found in the resume text" has no source yet.

**Narration beats** (Ruling 75). Aaron's two lines are verbatim from the spec:
- `review`: "Splits lines up everyone who spent their one pick on this role, so the team can compare them side by side."
- `sent`: "Splits then puts together a one-page profile so the founder can see the candidate's experience."
- `interested`: "Splits now helps the talent team make the warm intro."
- `notNow`: "Splits frees {name}'s pick, and their next match goes live."
- `sentInstead`: "{rival}'s one-pager goes to the founder instead. Splits frees {name}'s pick, and their next match goes live." (draft)
- `introSent`: "Sent. Splits keeps tracking from here." (draft)
- `twoWeeks`: "Splits keeps tracking: the first chat, the interviews, the offer."

- [ ] **Step 1: Write the failing e2e** (Sam, three eligible matches brought forward, the request on #1):
  - **The full walk:**
    - Review shows two rivals (`// Catches:` a compare with no one to compare);
    - Send opens `[data-founder-panel]` and focuses its heading, and the chip reads acting as the founder (`// Catches:` the view shift not said);
    - Yes moves the card to Connected and shows the draft;
    - "Send the intro" then "Two weeks later" shows `[data-finished-sample]`, and the learned strip has 4 lines;
    - each step's `[data-narration]` text matches the beat's copy (`// Catches:` a silent step).
  - **Not now:** the visitor's card for #2 appears in Requested. On Candidate, the Board's shortlist shows #2 with Requested (`// Catches:` desk and shortlist out of sync).
  - **Send instead:** same as Not now. The rival never appears in With founder (`// Catches:` a rival at a real company moving on).
  - **With a single brought-forward match,** Not now leaves the nudge and a working "Two weeks later" (Review Focus 3).
  - **Swap:** while the compare drawer is open, flip to Candidate, use PR 6's "Move my request here" on #2, and flip back. The drawer shows #2's company (Review Focus 2).
  - **Keyboard:**
    - in the founder panel, Tab cycles inside it;
    - Escape closes it, the card stays in With founder, and focus is on the visitor's card;
    - "Open the one-pager" reopens it;
    - in the compare drawer, focus lands on its heading, and Escape closes it (Review Focus 4).
  - **A rebuild mid-walk:**
    - walk to Connected, then Start over from the account menu;
    - pick Sam again, bring three forward, spend the request, and flip;
    - the visitor's card is in Requested, `[data-narration]` reads the `arrive` line, and no panel is open (Review Focus 1, `// Catches:` desk state surviving a rebuild).
- [ ] **Step 2: Run it red** (`-g "desk walk"`). Expected: FAIL.
- [ ] **Step 3: Implement** the change. `Desk.tsx` stays under 200 lines by keeping each mode in its own file.
- [ ] **Step 4: Run it green, plus `pnpm test` and `pnpm tsc --noEmit`.** Expected: pass.
- [ ] **Step 5: Commit** as `feat(desk): compare, the founder's one-pager, the connect and a finished sample (Rulings 74 to 78)`.

### Task 6: The earned door, the Why card, phones

**Files:**
- Modify:
  - `lib/speedrun/introSlot.ts` and its test (PR 6's pure per-match slot);
  - the detail-pane component that renders PR 6's `data-intro-here` line (grep for it);
  - `lib/content/speedrun.ts` (`team.earned`, `team.passedLine`, `decisions.cards`);
  - `e2e/speedrun-desk.spec.ts`.
- E2E_PORT 3334.

**Interfaces:**
- Consumes:
  - `onSide`, which reaches Matches through `NetworkPhase`;
  - `state.passed`;
  - PR 6's detail-pane hooks: `data-request-intro`, `data-bring-forward` (`aria-pressed`, constant name "Bring forward"), `data-intro-on`, `data-swap-intro` and `data-intro-here`.
  - List rows use `data-row-bring-forward`. Focus moves to the `data-intro-here` line after a request or a swap.
- Produces:
  - `data-earned-door`;
  - `data-intro-passed`;
  - an `introSlot` variant for passed keys: its input gains `passed`, and the passed variant beats every other slot.

**The earned door** (Ruling 72) lives in PR 6's `data-intro-here` line, on the match whose key is `introRequest.matchKey` (never by position). PR 6's line always reads "Intro requested. The talent team reviews it next.", whatever the status, so PR 7 makes it status-aware:
- **At `requested`:** the line `team.earned.line`, verbatim from the spec: "Sent. It just landed on the speedrun team's desk. What does this unlock for them?";
- **At `withFounder` or `connected`:** a line that names the status in the desk's words (`team.earned.status(stage)`, using `team.stages`);
- **The button, at all three:** the filled primary button `team.earned.button` ("See the talent team's side"). It calls `onSide("team")` and moves focus to the desk's heading.

**Locked:** at `withFounder` or `connected`, the detail pane's Bring forward toggle on the requested match is `aria-disabled`, matching Task 1's reducer guard.

**A passed match** (a key in `state.passed`) gets the slot's passed variant: `team.passedLine.team` ("The team sent someone else this time.") or `team.passedLine.founder` ("The founder said not now."), in place of every request control (no `data-request-intro`, `data-swap-intro` or `data-intro-on`). Both lines are drafts. Hook: `data-intro-passed`.

**The Why card** (spec section 7): append `{ title: "Every intro teaches the matching.", body: "A short survey asks both sides whether a miss was the match or the people. Only the match misses change who gets matched." }` to `decisions.cards`.

- [ ] **Step 1: Write the failing e2e:**
  - spend the request, and `[data-earned-door]` shows on that match with the line. Its button shows the desk with the visitor's card first in Requested, and focus on the desk heading (`// Catches:` the earned moment missing);
  - under `reducedMotion: "reduce"`, the visitor's card has no running animation on arrival (`document.getAnimations()` count is 0 inside `[data-desk]`) (`// Catches:` motion under reduced motion);
  - the Why tab lists "Every intro teaches the matching." (`// Catches:` the survey's decision missing);
  - after Not now on the desk, the passed match on Matches shows `[data-intro-passed]` with the founder line, and no request or "Move my request here" button (`// Catches:` re-requesting a match the founder passed);
  - after moving another pick above the live request on the Board, `[data-earned-door]` is still on the requested match (`// Catches:` the door following #1 instead of the request);
  - after Send on the desk, the requested match's `[data-intro-here]` names With founder (not "reviews it next"), and its `[data-bring-forward]` has `aria-disabled="true"` (`// Catches:` a stale status line, and a withdrawable request after the desk moved it);
  - vitest in `introSlot.test.ts`: a passed key yields the passed variant even when the key is eligible, on the shortlist, and there is no live request;
  - at 320 and 390, on the team side, with the drawer open and with the founder panel open, `document.documentElement.scrollWidth` equals the viewport width. Both panels' widths are at least the viewport minus 32 (Review Focus 5).
- [ ] **Step 2: Run it red** (`-g "earned|reduced|why card|desk phone"`). Show at least one pin red first by dropping its guard, running, and restoring. Save the log.
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run the full default suite** through the slot script (no `-g`). Expected: all pass, 0 failed. Then `pnpm test`, `pnpm tsc --noEmit` and `pnpm lint`.
- [ ] **Step 5: Commit** as `feat(desk): the earned door, the survey's Why card, phone pins (Ruling 72, section 7)`.

### Task 7: Docs

**Files:**
- Modify: `AGENTS.md`, Layer 2 only, in its own commit.

Layer 2 gains these lines, and nothing else:
- **Map:** `components/speedrun/team/` is the talent team's desk.
- **Invariant:** the desk's walk runs only through `deskStep` (`lib/speedrun/desk.ts`). An illegal action is a no-op, and the request changes only through its effect.
- **Invariant:** `PhaseState.side` is `candidate` on every phase change. The candidate panels stay mounted on the team side.
- **Invariant:** sample desk cards name only fictional companies, and the deskSamples test checks it.

Update "Last verified". Run `wc -c AGENTS.md` first: the Layer 2 budget is 6,000 characters, so cut the least load-bearing line if over.

- [ ] **Step 1: Edit, check the budget, and commit** as `docs(agents): the talent team's desk`.

---

## Handoff

- **Controller:** the Speedrun Builder's current shift, or this session if Aaron asks. Execute with superpowers:subagent-driven-development, with Sonnet implementers and Opus reviewers. Visual judgment stays with the controller: check 1440 and 390 yourself after Tasks 3, 4, 5 and 6.
- **Gate:** the site's lead orchestrator gates the PR at 390 and 1440 in Chromium, desktop WebKit and iPhone WebKit. Send it the head SHA when the PR is open.
- **Draft copy for Aaron** (the PR body lists every one):
  - `team.heading`, `team.intro`, `team.beats.*` except his two lines;
  - `team.nudge`, `team.earned.*`, `team.intro.body`;
  - `team.founder.*`, `team.sample.*`, `team.fullVersion.*`;
  - the Why card.
