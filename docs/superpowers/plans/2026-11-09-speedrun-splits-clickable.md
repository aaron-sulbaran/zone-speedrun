# /speedrun as Splits: one-screen hero and app shell (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn /speedrun into a click-driven product demo:
- a one-screen hero with a short intro you can skip;
- a button that plays the existing switch into the join phase;
- after onboarding, an app shell (top bar, tabs, match list and detail) where the page never scrolls.

**Architecture:**
- **Pure logic in `lib/speedrun/`,** tested with vitest: the intro schedule, the hero's flow data, and the match list's selection model.
- **The hero** is one client component tree. Every word is in the server HTML. A CSS gate plus a Web Animations runner plays the intro, and a failsafe reveals the words if JS never runs.
- **The network phase** becomes a CSS-grid shell sized to the viewport. Its panels scroll inside, and one tablist moves between the top bar (lg) and the bottom row (below lg) through grid areas.

**Tech Stack:**
- Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind 3.4 over CSS custom properties;
- Web Animations through `lib/speedrun/motion.ts`, Lucide icons;
- vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-speedrun-splits-clickable-design.md`

## Global Constraints

### Copy
- All copy lives in `lib/content/speedrun.ts`. Components never embed strings.
- No em dashes anywhere: copy, comments, commits.
- These strings are fixed:
  - "job hunting sux."
  - "I would know."
  - "As an ECE student at UT Austin, I sent {n} applications this fall."
  - "That's why I built Splits."
  - "How my product would look, built in y'all's style."
  - "See where speedrun could go"
  - "Numbers nudged for privacy. No company names."
  - "Splits · a concept"
  - "Splits · Join"
  - "Concept · not affiliated"
  - "Why" (the tab label)
  - "Next: Why"
  - "Splits: a concept for the speedrun talent team · Aaron Sulbaran" (the meta title)
- The paragraph drafts are fixed verbatim:
  - **p1:** "I've been grinding for internships for a long time. Every recruiting season I know I'm not the only one suffering, because my friends are too."
  - **p2:** "I believe in what speedrun is doing: actually helping people land these jobs, not just listing them. Building that with you sounds like a lot of fun."

### Styling
- **Tokens only.**
  - The hero (act 1) uses the site's tokens (`bg-background`, `text-foreground`, `text-muted`, `bg-accent`, `font-display`, `font-label`).
  - The shell (act 2) uses the `sr-*` tokens.
  - `bg-x/NN` emits nothing on `var()` colors under Tailwind 3, so use solid tokens.
- **No backdrop blur** on the phone dock or the shell's bars.

### Motion
- **Every motion value** is a `Motion` key in `lib/speedrun/motion.ts`, read through `motion()`.
- **Animations are Web Animations.** Only opacity and transform animate, and there is no layout shift.
- **Reduced motion** skips every intro, flight and slide.

### Components and logic
- Components stay under about 200 lines.
- New logic goes in pure, tested modules under `lib/speedrun/`.
- Server Components for pure layout; `"use client"` only where needed.

### Z scale
- Content is 10, and the phone dock sits at `z-10`, after the content in DOM order.
- The site chrome (logo and Menu pill) is 40 and must stay clickable.

### Git
- Stage files by name; never `git add -A`.
- Small commits, each ending `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never push, merge or deploy.

### Checks
- **Before every commit:** `pnpm vitest run && pnpm tsc --noEmit && pnpm lint`.
- **Once per task:** `pnpm build`.

### e2e
- **Two runs at most, at once.** Every e2e run goes through the slot script, so no more than two Playwright runs ever overlap.
- **The command,** after `lsof -iTCP:3152 -iTCP:3153 -sTCP:LISTEN` shows both ports free:

  ```bash
  .superpowers/sdd/2026-11-08-speedrun-onboarding/pwslot.sh "$PWD" <scratchpad>/e2e-<task>.log env CI=1 E2E_FULL_PORT=3152 E2E_HOLDING_PORT=3153 pnpm test:e2e e2e/speedrun
  ```
- **Off-limits:** never stop ports 3220, 3221, 3276 or 3277. Never set `SPEEDRUN_AI=on` or `SPEEDRUN_EMAIL=on`.

### Test pins
Every new e2e pin carries a one-line comment naming the regression it catches, and must go red if that guard is removed. Read state in the same tick as the trigger (`page.evaluate`), and use bounded negative waits for "never happens" assertions.

## Review Focus

1. **Escape in the connect sheet inside a phone match detail** closes only the sheet. The detail stays open. Pinned in Task 5.
2. **Widening from 390 to 1440 with a detail open** keeps that match selected in the two-pane view. Pinned in Task 5.
3. **Tab or any key during the intro** finishes it, and focus moves normally (the first Tab is not swallowed). Pinned in Task 3.
4. **A 40-character visitor name** fits the account button, the menu and the list header at 375, with no horizontal scroll. Pinned in Task 4.
5. **An empty match result:** Up and Down do nothing, and both the list and the detail area show the empty copy. Pinned in Task 1 (selection model) and Task 5 (render).

---

### Task 1: The pure modules (intro schedule, hero flow data, match list model)

**Files:**
- Modify: `lib/speedrun/motion.ts`, `lib/speedrun/tuningPresets.ts`, `lib/speedrun/aaronMock.ts`
- Create: `lib/speedrun/heroIntro.ts`, `lib/speedrun/heroIntro.test.ts`, `lib/speedrun/matchList.ts`, `lib/speedrun/matchList.test.ts`
- Test: add to the existing aaronMock test file if there is one, otherwise create `lib/speedrun/aaronMock.test.ts`

**Interfaces:**
- **New `Motion` keys, with `MOTION` defaults:**
  - the words: `introWordStaggerMs: 120`, `introWordMs: 420`, `introRisePx: 8`;
  - the later fades: `introSecondAtMs: 700`, `introSubtitleAtMs: 1100`, `introParagraphsAtMs: 2300`, `introParagraphStaggerMs: 150`, `introCloseAtMs: 3000`;
  - the flight and the links: `introFlightAtMs: 1500`, `introFlightMs: 520`, `introLinksMs: 1100`.

  Each key gets a `TUNING_RANGES` entry: `ms(...)` with a max of at least 2x the default, and `px(48)` for `introRisePx`.
- **The intro schedule** (`heroIntro.ts`):
  - `type IntroTarget = "word" | "second" | "subtitle" | "flight" | "links" | "paragraph" | "close"`
  - `type IntroCue = { target: IntroTarget; index: number; atMs: number; durationMs: number }`
  - `introCues(m: Motion, counts: { words: number; paragraphs: number }): IntroCue[]`, sorted by `atMs`, ties in the target order above.
    - Every fade (word, second, subtitle, paragraph, close) lasts `introWordMs`.
    - The flight lasts `introFlightMs`.
    - The links start at `introFlightAtMs + introFlightMs` and last `introLinksMs`.
  - `introEndMs(cues: IntroCue[]): number`: the largest `atMs + durationMs`.
  - `pressableAtMs(cues: IntroCue[]): number`: the close cue's `atMs`.
- **The hero's flow data:** `aaronFlow(opts?: { lanes?: boolean }): FlowData`.
  - The default `lanes: true` is unchanged (the board's chart uses it).
  - `lanes: false` returns `toFlow(AARON_MOCK)`. All rows share one lane, so `toFlow`'s `"auto"` already leaves the lane column out.
- **The match list model** (`matchList.ts`):
  - `type ListItem = { key: string; kind: "founder" } | { key: string; kind: "match"; match: Match }`
  - `FOUNDER_KEY = "founder"`
  - `matchKey(match: Match): string` returns `` `${match.company.name}-${match.role?.id ?? "company"}` `` (the key `Matches.tsx` uses today).
  - `listItems(result: MatchResult): ListItem[]` puts the founder item first when `result.routes.length > 0`, then one item per match.
  - `moveSelection(items: ListItem[], current: string | null, direction: "up" | "down"): string | null`
    - It clamps at both ends, with no wrap.
    - An unknown or null `current` gives the first key.
    - An empty list gives `null`.
  - `reasonLine(match: Match): string` returns `match.reasons[0]?.text ?? match.company.blurb`.

- [ ] **Step 1: Write the failing tests.**
  - **`heroIntro.test.ts`,** with `MOTION` and `{ words: 3, paragraphs: 2 }`:
    - words at 0, 120 and 240, each lasting 420;
    - `second` at 700, `subtitle` at 1100;
    - `flight` at 1500 lasting 520, `links` at 2020 lasting 1100;
    - paragraphs at 2300 and 2450;
    - `close` at 3000;
    - `introEndMs === 3420` and `pressableAtMs === 3000`;
    - `atMs` never decreases across the array, and `close` has the largest `atMs`;
    - with `introWordStaggerMs: 0`, every word is at 0.
  - **The aaronMock test:**
    - `aaronFlow({ lanes: false })` has no node with `kind === "lane"`;
    - its only column-0 node is `stage:applied`;
    - the links leaving `stage:applied` plus that node's exits sum to `AARON_ENTRIES.length` (84);
    - `aaronFlow()` still has 4 lane nodes.
  - **`matchList.test.ts`,** using two fake `Match` objects built inline:
    - the founder item comes first only when there are routes;
    - every key is unique;
    - down from the last key stays on the last, and up from the first stays on the first;
    - an unknown current gives the first key;
    - an empty list gives `null` both ways;
    - `reasonLine` falls back to the blurb when there are no reasons.
- [ ] **Step 2: Run the tests to see them fail.** `pnpm vitest run lib/speedrun/heroIntro.test.ts lib/speedrun/matchList.test.ts lib/speedrun/aaronMock.test.ts` should FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run the checks and the build.** `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build` should all pass. `tuningPresets.test.ts` must still pass with the new keys.
- [ ] **Step 5: Commit.** Message: "Speedrun page: the intro schedule, the hero's one-lane flow and the match list model".

---

### Task 2: The static hero, the docked button and the Splits name

The hero renders its end state with no motion yet (Task 3 adds the intro).

**Files:**
- Create:
  - `components/speedrun/act1/SplitsHero.tsx`: the layout, the kicker, the headline, the second line, the subtitle and the paragraphs.
  - `components/speedrun/act1/HeroClose.tsx`: the closing block; static on lg, docked below lg.
- Modify:
  - `components/speedrun/FlowChart.tsx`: the hero sizes.
  - `components/speedrun/Shift.tsx`: drop the turn lines and its button.
  - `components/speedrun/SpeedrunExperience.tsx`: render the hero, and its button bumps `playSignal`.
  - `app/speedrun/page.tsx`: drop the `opener` prop.
  - `components/speedrun/act2/Hero.tsx`: drop the lede.
  - `lib/content/speedrun.ts`.
- Delete:
  - `components/speedrun/act1/Opener.tsx` and `components/speedrun/act1/AaronFunnel.tsx`;
  - `aaronSampleRows` and the copy keys that only they used, if nothing else imports them (grep first).
- Test: `e2e/speedrun-flow.ts`, `e2e/speedrun.spec.ts`, and `lib/content/speedrun.test.ts` (create it if it doesn't exist).

**Interfaces:**
- **Consumes** `aaronFlow({ lanes: false })` and `AARON_ENTRIES` from Task 1.
- **Produces:**
  - **The hero's DOM hooks.**
    - The root is `<section data-hero="">`.
    - Every element the intro animates carries `data-intro-el="<target>"` (the targets from Task 1) and `data-intro-index`. There are three words, so the headline is split into three spans.
    - The subtitle's number is `<span data-hero-count="">`.
    - The closing block carries `data-intro-el="close"`.
  - **The button:** `<button data-hero-start="">` with the accessible name "See where speedrun could go". It calls the `onStart: () => void` prop.
  - **`SplitsHero`'s props:** `{ onStart: () => void }`.
  - **`FlowChart`'s new prop:** `size?: "full" | "hero"` (default `"full"`).
    - `"hero"` renders two horizontal SVGs, with no vertical layout and no lane offset:
      - `HERO_WIDE` is 560 by 300 and shows from lg (`hidden lg:block`);
      - `HERO_NARROW` is 360 by 200 and shows below lg (`lg:hidden`).
    - Label font size is 12 in both.
    - In each SVG, the applied node's value text carries `data-flow-source-value=""` and the links group carries `data-flow-links=""`.
  - **New copy keys:**
    - `act1.subtitle = { before, count: (n: number) => string, after }`;
    - `act1.p1`, `act1.p2` and `act1.privacyNote`;
    - `act1.closing = { line, sub, button }`.

    `shift.turnLine1`, `shift.turnLine2` and `shift.button` are removed, and `shift.line` stays.
  - **Copy changes:**
    - `hero.eyebrow` becomes "Splits · a concept", and `hero.lede` is removed;
    - `join.label` becomes "Splits · Join";
    - `meta.title` becomes the Splits title.

- [ ] **Step 1: Write the failing tests.**
  - **`lib/content/speedrun.test.ts`:**
    - `act1.subtitle.count(AARON_ENTRIES.length)` contains "84 applications".
    - No string in `speedrunCopy` contains "—".
  - **`e2e/speedrun-flow.ts`:** `playSwitch` clicks `getByRole("button", { name: speedrunCopy.act1.closing.button })`.
  - **New tests in `e2e/speedrun.spec.ts`,** each with its regression comment:
    - **"every word of the hero is in the server HTML":** `request.get("/speedrun")` contains the headline, the second line, "84 applications", p1, p2 and the three closing strings. *Catches: hero words rendered client-only.*
    - **"the hero fits one screen at 1440 by 900 and 1280 by 800":** at each size, `scrollHeight <= innerHeight`, and the button's `getBoundingClientRect().bottom <= innerHeight`. *Catches: a hero taller than the screen.*
    - **"on a phone the button is docked and fully visible on load at 390 by 844 and 375 by 667":** the button's top is at least 0, its bottom is at most `innerHeight`, and its container computes `position: fixed`. *Catches: an undocked button below the fold.*
    - **"no horizontal scroll on the hero at 375, 390, 768, 1280 and 1440".**
    - **"the chart's applied value matches the subtitle":** the visible `[data-flow-source-value]` text equals the `[data-hero-count]` number.
  - **Update** "the opener shows first..." to the new hero. Delete assertions on the funnel card, the stat tiles and the turn lines.
- [ ] **Step 2: Run the unit test, and the e2e under the slot script, to see the new ones fail.**
- [ ] **Step 3: Implement the hero.**
  - **The `SplitsHero` layout:**
    - **lg:** a two-column grid, `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center`. The text is on the left, and the chart plus the privacy note on the right. `HeroClose` is centered under both columns. The whole thing is vertically centered in `min-h-[100dvh]`, with top padding that clears the site chrome.
    - **Below lg:** one stack, with the chart directly under the subtitle. Bottom padding equals the dock's height.
    - **The subtitle's number** renders `act1.subtitle.count(AARON_ENTRIES.length)`. Never a literal 84.
    - **The chart** is `<FlowChart data={aaronFlow({ lanes: false })} tone="aaron" size="hero" title={act1.flowTitle} />`.
  - **`HeroClose`:**
    - below lg: `fixed inset-x-0 bottom-0 z-10 bg-background border-t border-border`, with safe-area bottom padding (`pb-[max(1rem,env(safe-area-inset-bottom))]`);
    - from lg: `lg:static lg:border-0`.
    - The button is at least 56 px tall with about a 20 px label, in `bg-accent text-background rounded-full`.
  - **The switch.** `Switch` keeps only the strip and its `play`. `SpeedrunExperience` passes `onStart={() => setPlaySignal((n) => n + 1)}`; the existing `playSignal` effect plays it, and `busy` already ignores a second press.
  - **The join hero.** `act2/Hero.tsx` drops the lede paragraph only.
- [ ] **Step 4: Run the checks, the build and the speedrun e2e** (slot script). Everything should pass.
- [ ] **Step 5: Commit.** Message: "Speedrun page: Splits, a one-screen hero with a docked button on phones".

---

### Task 3: The intro: words, the 84's flight, the links, skip

**Files:**
- Create: `components/speedrun/act1/useHeroIntro.ts`
- Modify: `components/speedrun/act1/SplitsHero.tsx` (call the hook, set `data-intro`), `components/speedrun/act1/HeroClose.tsx` (guard presses before it settles), `app/globals.css` (the gate and the failsafe), `e2e/speedrun-flow.ts`, `e2e/speedrun.spec.ts`

**Interfaces:**
- **Consumes:** `introCues`, `introEndMs` and `pressableAtMs` (Task 1), and the DOM hooks from Task 2.
- **Produces:**
  - `useHeroIntro(root: RefObject<HTMLElement | null>): { settled: () => boolean }`.
  - **The root's `data-intro`:** `"running"` while the intro plays, `"done"` after it finishes or is skipped, and `"done"` from the start under reduced motion.
  - **The e2e helper** `settleHero(page)`. It waits for `[data-hero][data-intro]`, dispatches a `pointerdown` on `[data-hero]`, then expects `data-intro="done"`. `playSwitch` calls it before clicking.

**The CSS gate and failsafe** (in `app/globals.css`, next to the other `/speedrun` rules, no reduced-motion override needed):
- **Before JS runs:** `[data-hero]:not([data-intro="done"]) [data-intro-el]` starts at `opacity: 0`. A CSS animation `sr-intro-failsafe` sets `opacity: 1`, running 0 ms with a 3,500 ms delay and `forwards`.
- **While JS runs:** `[data-hero][data-intro="running"] [data-intro-el]` sets `animation: none`, and the Web Animations take over.
- **When done:** `[data-hero][data-intro="done"] [data-intro-el]` sets `opacity: 1`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` sets `[data-intro-el]` to `opacity: 1` and `animation: none`.

**The runner** (`useHeroIntro`, in a layout effect):
- **Reduced motion:** set `"done"` and return.
- **Otherwise:** set `"running"`, then run `introCues(motion(), …)`.
  - **Fades** animate `{ opacity: 0, transform: translateY(introRisePx) }` to `{ opacity: 1, transform: none }`, with `delay` set to `atMs`, `fill: "both"` and `SR_EASE`.
  - **The flight** clones the `[data-hero-count]` span into an absolutely positioned `<span data-intro-flight="">` on the hero root. It animates a FLIP translate and scale to the visible `[data-flow-source-value]` box: the SVG whose `checkVisibility()` is true. The target value text stays at opacity 0 until the clone lands, then shows, and the clone is removed.
  - **The links reveal** animates `clip-path: inset(0 100% 0 0)` to `inset(0 0 0 0)` on the visible `[data-flow-links]`.
  - When every animation's `finished` resolves, set `"done"`.
- **Skip.** Capture-phase listeners on `document` (`pointerdown`, `keydown`, `wheel`, `touchmove`, `{ capture: true, passive: true }`). While `"running"`, they call `finish()` on each tracked animation, remove the clone, show the target value and set `"done"` in the same call.
- **Cleanup** cancels everything and removes the listeners.
- **`settled()`** is true once `data-intro === "done"`.

**The press guard** (`HeroClose`):
- The button records `settled()` in its own `onPointerDownCapture` and `onKeyDownCapture`. These run before the document skip listener settles the intro.
- `onClick` returns early when the recorded value was false. That way a press during the intro only skips it.

- [ ] **Step 1: Write the failing e2e pins in `e2e/speedrun.spec.ts`,** each with its regression comment.
  - **"a pointerdown during the intro shows the end state in the same tick".** Wait for `data-intro="running"`. Then, in one `page.evaluate`, dispatch `pointerdown` on `[data-hero]` and return every `[data-intro-el]` computed opacity plus `data-intro`. Expect all `"1"` and `"done"`. *Catches: the skip listener removed or not finishing animations.*
  - **"Tab during the intro finishes it and moves focus".** While running, press Tab. Expect `"done"`, and expect `document.activeElement` is not `body`. *Catches: a skip that swallows the first key.*
  - **"a press on the button before it settles skips and does not play the switch".**
    - While running, click `[data-hero-start]`, then expect `"done"`.
    - Then make sure the switch never ran. Install an `addInitScript` counter on `Element.prototype.animate` for `[data-shift-strip]`, then wait 1,500 ms. Expect zero strip animations and no `#act-2`.
    - *Catches: the press guard removed.*
  - **"the closing block arrives last".**
    - Read `document.getAnimations()` the moment `"running"` is set.
    - Map each effect's target `data-intro-el` to `effect.getTiming().delay`.
    - Expect the `close` delay to equal 3000 and to be the largest.
    - *Catches: reordered cues.*
  - **"with reduced motion the end state shows at once and nothing flies"** (`reducedMotion: "reduce"`).
    - An `addInitScript` MutationObserver counts `[data-intro-flight]` additions.
    - Right after load, every `[data-intro-el]` opacity is `"1"`, `data-intro` is `"done"`, and the count is 0 after a bounded 1,000 ms wait.
    - *Catches: intro ignoring reduced motion.*
  - **"without JavaScript the words still appear"** (`javaScriptEnabled: false`). After 4,000 ms every `[data-intro-el]` opacity is `"1"`. *Catches: the failsafe removed.*
  - **"Replay from the top plays the intro again".**
    - Get through onboarding with `skipToSam`, then run the replay helper `replayFromTop(page)`. Add the helper to `e2e/speedrun-flow.ts`. For now it clicks today's "Replay from the top" button, and Task 4 points it at the account menu.
    - Expect `data-intro="running"` to be observed (MutationObserver), then `"done"`.
    - *Catches: the intro playing only on first load.*
- [ ] **Step 2: Run them to see them fail** (slot script).
- [ ] **Step 3: Implement** per Interfaces, and update `playSwitch` to call `settleHero` first.
- [ ] **Step 4: Run the checks, the build and the whole speedrun e2e.** Everything should pass, the Task 2 fit pins included.
- [ ] **Step 5: Commit.** Message: "Speedrun page: the hero's intro, with the 84 flying into the chart and a skip on any input".

---

### Task 4: The app shell frame

**Files:**
- Create: `components/speedrun/shell/AppShell.tsx`, `components/speedrun/shell/TopBar.tsx`, `components/speedrun/shell/AccountMenu.tsx`
- Modify:
  - `components/speedrun/phases/NetworkPhase.tsx`: use the shell; Close moves into the decisions panel.
  - `components/speedrun/act2/NetworkTabs.tsx`: add icons, and style for both placements.
  - `components/speedrun/act2/Close.tsx`: a dark card instead of a band.
  - `components/speedrun/SpeedrunExperience.tsx`: no `PinnedAffiliation` in the network phase.
  - `components/speedrun/visitorName.ts`.
  - `lib/content/speedrun.ts`.
  - `e2e/speedrun-flow.ts` and `e2e/speedrun.spec.ts`.
- Delete: `components/speedrun/act2/NetworkHeader.tsx`

**Interfaces:**
- **Produces:**
  - `visitorFirstName(state): string | null`: the typed or sample name with no fallback (`displayName(..., "")`, where an empty string becomes null).
  - **`AppShell`'s props:** `{ name: string | null; tab: NetworkTab; onTab: (tab: NetworkTab) => void; onStartOver: () => void; onReplayTop: () => void; children: ReactNode }`.
  - **The DOM hooks:**
    - the root is `<div data-shell="">`;
    - the scrolling panel area is `[data-shell-main]`;
    - the tablist stays `role="tablist"`, and the tab and panel ids are unchanged (`sr-tab-*`, `sr-panel-*`).
  - **New copy keys:**
    - `network.wordmark`: "Splits";
    - `network.badge`: "Concept · not affiliated";
    - `network.account`: `{ label: "Your account", startOver, replayTop }` (move today's strings here);
    - `network.tabs.decisions`: "Why";
    - `network.nextTo.brief`: "Next: Why".

    `network.heading`, `network.tag` and `network.next` are removed.
  - **e2e helpers:**
    - `openAccountMenu(page)`;
    - `replayFromTop(page)` and a new `startOver(page)`, both through the menu.

**The shell layout** (one tablist, placed by grid areas):
- **Size.** The root is `grid h-[100dvh] pt-20` (`pt-20` clears the site chrome), with `[@media(max-height:559px)]:h-auto`.
- **Below lg:** areas `"top" "main" "tabs"` and rows `auto minmax(0,1fr) auto`.
- **From lg:** areas `"top tabs" "main main"` and rows `auto minmax(0,1fr)`.
- **The tablist:**
  - below lg it is the bottom row: icon above label, full width, safe-area bottom padding;
  - from lg it sits in the top bar row: pills with no icons.
- **Each panel** is `h-full overflow-y-auto overscroll-contain`, with `[@media(max-height:559px)]:overflow-visible`.
- **The top bar holds:**
  - `SpeedrunLogo`, which keeps `data-egg-logo`, so the egg still works;
  - the wordmark;
  - the badge, at every width;
  - `AccountMenu`.
- **`AccountMenu`'s button** shows the first code point of `name`, upper-cased, or a Lucide `User` icon when `name` is null. It has `aria-label` from `network.account.label`, `aria-expanded` and `aria-controls`.
- **`AccountMenu`'s panel:**
  - **Contents:** the full name (`break-words`), Start over, Replay from the top, and `speedrunCopy.affiliation`.
  - **Closing it:** Escape closes it and focuses the button. A `pointerdown` outside closes it. An action closes it first, then calls the handler.
  - **Placement:** it stays inside the viewport at 375.

- [ ] **Step 1: Write the failing tests,** each with its regression comment.
  - **Update:**
    - the arrow/Home/End tab test uses "Why";
    - "Start over returns to step 1..." and the reduced-motion "Replay from the top re-arms it" go through `openAccountMenu`;
    - "the decisions and the close are on the page" becomes "the Why tab holds the decisions, then the close card with the affiliation line".
  - **Delete:** "the pinned affiliation steps aside at the close".
  - **Add:**
    - **"the shell never scrolls the document":** at 1440 by 900 and 390 by 844, on each of the four tabs, `scrollHeight === innerHeight`. *Catches: a shell that isn't capped to the viewport.*
    - **"no horizontal scroll in the shell":** at 375, 768 and 1440 wide, on each tab, `scrollWidth <= innerWidth`.
    - **"tabs sit at the bottom on a phone and in the top bar on desktop":** at 390 by 844 the tablist's `bottom` is within 2 px of `innerHeight`. At 1440 by 900 its `top` is under 200. *Catches: wrong grid areas.*
    - **"the badge shows at every width, and the pinned pill is gone in the network phase".**
    - **"a short landscape screen falls back to page scroll":** at 844 by 390, the active panel's `overflow-y` computes to `visible` and `scrollHeight > innerHeight`. *Catches: the fallback removed.*
    - **"a 40-character name fits at 375"** (Review Focus 4). Type a 40-code-point name and finish onboarding. Then `scrollWidth <= innerWidth`, both closed and with the menu open, and the menu's box sits inside the viewport.
    - **"Escape closes the account menu and returns focus to its button", and "Start over from the menu closes it".**
- [ ] **Step 2: Run them to see them fail** (slot script).
- [ ] **Step 3: Implement** per Interfaces. For now, `Matches` renders inside its panel unchanged (Task 5 replaces it).
- [ ] **Step 4: Run the checks, the build and the whole speedrun e2e.** Everything should pass.
- [ ] **Step 5: Commit.** Message: "Speedrun page: the network becomes an app shell: top bar, account menu, tabs at the bottom on phones".

---

### Task 5: Matches as a list and detail

**Files:**
- Create: `components/speedrun/act2/MatchList.tsx`, `components/speedrun/act2/MatchDetail.tsx`
- Modify:
  - `components/speedrun/act2/Matches.tsx`: it becomes the two-pane container and owns the selection state.
  - `components/speedrun/act2/MatchCard.tsx`: export `CompanyLogo`. Its sheet's Escape handler calls `event.preventDefault()`.
  - `lib/content/speedrun.ts`.
  - `e2e/speedrun-matches.spec.ts`, `e2e/speedrun-upload.spec.ts` and `e2e/speedrun.spec.ts` where they reference `data-match-card`.

**Interfaces:**
- **Consumes:**
  - `listItems`, `moveSelection`, `reasonLine` and `FOUNDER_KEY` (Task 1);
  - `visitorFirstName` (Task 4);
  - `motion().stepMs` and `STEP_EASE`.
- **Produces:**
  - **Rows:** `<button data-match-row="<key>">`, with `aria-current="true"` on the selected one.
  - **The detail:** `[data-match-detail]`. Its heading carries `data-detail-heading` and `tabIndex={-1}`.
  - **The back button:** `[data-detail-back]`, shown below lg only.
  - **New copy keys:**
    - `matches.listHeading: (name: string | null) => string`. It returns "{name}'s matches", or "Your matches" when the name is null.
    - `matches.listCount: (n: number) => string`, which reads "{n} worth your time first".
    - `matches.founderRow`, "Founder route". Its reason line reuses `matches.founder.heading`, or `mentioned` when the visitor mentioned founding.
    - `matches.back`, "Back to matches".
  - **The list header's `h2`** carries `data-phase-heading` and `tabIndex={-1}`, so `usePhaseChange` focuses it on entry.

**Behavior:**
- **State:** `selectedKey`, which starts on the first item, and `detailOpen`, which starts false.
- **The detail** renders `FounderRoute` for the founder key, and otherwise `MatchCard`, which keeps its own Apply and Connect controls.
- **Layout:**
  - **lg:** two columns, the list at `lg:w-[380px]` and the detail at `flex-1`, each `overflow-y-auto`. `detailOpen` is ignored.
  - **Below lg:** the detail is `absolute inset-0` over the list.
    - It is shown only while `detailOpen` (`max-lg:hidden` otherwise).
    - Opening slides it in with `translateX(100%)` to `0` over `stepMs`, `STEP_EASE`. Closing reverses that, and both are skipped under reduced motion.
- **Clicking a row** sets `selectedKey`. Below lg it also sets `detailOpen` and focuses `[data-detail-heading]` after the slide starts. To know which layout is live, check `matchMedia("(min-width: 1024px)")` at event time.
- **Keys in the list:**
  - Up and Down call `moveSelection` and focus the new row. Focus never leaves the list.
  - On an empty list both are no-ops.
- **Closing the detail below lg.** The Back button, or an Escape the detail receives with `!event.defaultPrevented`, closes it and focuses the row for `selectedKey`.
- **Empty result:** the list shows `matches.empty`, and the detail area shows the same line.

- [ ] **Step 1: Rewrite `e2e/speedrun-matches.spec.ts` and add the pins,** each with its regression comment.
  - **"Sam sees the build log, the made-for beat, then a list of matches with reasons":** each row's text contains its reason line.
  - **"desktop: the first match is selected and its detail shows beside the list":** at 1440, row 1 has `aria-current="true"`, and the detail heading has the row's company.
  - **"Up and Down move the selection and keep focus in the list":** Down three times, then Up from the first row stays on it. *Catches: wrap or focus loss.*
  - **"phone: a tap slides the detail in and focuses its heading; Back returns focus to the row":** at 390 by 844.
  - **"phone: Escape in the connect sheet closes only the sheet"** (Review Focus 1). Open the detail, open the connect sheet, then press Escape. The sheet is closed and `[data-match-detail]` is still visible. A second Escape closes the detail. *Catches: a missing `preventDefault` or `defaultPrevented` check.*
  - **"a detail opened at 390 stays selected at 1440"** (Review Focus 2). Open row 3 at 390, then resize to 1440. Row 3 has `aria-current="true"`, and the detail shows its company.
  - **"Dev sees the founder route row first, and its detail has both links".**
  - **"Apply opens the real role without agent tracking"** and **"Escape closes the connect sheet and keeps focus on its button":** keep the existing tests, now run inside the detail.
  - **"the list header names the visitor, or says Your matches without a name"** (the skip path uses Sam, and the upload path has no typed name).
- [ ] **Step 2: Run them to see them fail** (slot script).
- [ ] **Step 3: Implement** per Interfaces and Behavior. Keep `Matches.tsx`, `MatchList.tsx` and `MatchDetail.tsx` each under about 200 lines.
- [ ] **Step 4: Run the checks, the build and the whole speedrun e2e.** Everything should pass, Task 4's no-document-scroll pin included.
- [ ] **Step 5: Commit.** Message: "Speedrun page: matches as a list and a detail, sliding over on phones".

---

## After the tasks (the controller, not an implementer)

1. **Run the full checks on the branch head:**
   - `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`;
   - the whole speedrun e2e under the slot script;
   - `pnpm public:sync -- --ref claude/distracted-moser-bfd850`. This exports and verifies only; never pass `--push`. Verify must pass, and the export must still fast-forward the public main.
2. **Look at it in a browser** at 390 and 1440: the hero end state, the dock, the join card, the shell on all four tabs, and a phone detail. Run `design-review` on the hero and the shell. Visual judgment is never delegated.
3. **Get a whole-branch Opus review of this round's diff,** then a Fable 5.1 read. Verify their claims before adopting them.
4. **Push, then hand the new head to the lead** (`local_2d8302e7-12af-49b2-82f1-3d2fa0241ea2`) for its gate. Never merge.
5. **Update AGENTS.md Layer 2** only if a fact changed. Nothing in this plan changes one: the /speedrun line, the env, the ports and the export are untouched.
