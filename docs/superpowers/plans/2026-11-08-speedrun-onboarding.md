# /speedrun phased onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/speedrun` from one long scroll into four phases (opener, join, building, network), with a speedrun-style one-question-per-screen join, the approved switch landing on a phase, two resets, and a dev-only motion tuning panel.

**Architecture:** A pure phase reducer and a pure onboarding model in `lib/speedrun/` drive one client component, `SpeedrunExperience`, which renders exactly one phase inside `<main>`. The system (ranking, routes, guards) is untouched except two optional intake fields. Every timing lives in one `MOTION` object that a dev-only panel can override.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind 3.4 over CSS custom properties, Web Animations API (no new motion library), zod, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-speedrun-onboarding-design.md` (revises `docs/superpowers/specs/2026-11-07-speedrun-design.md`; read both). Research synthesis: `/private/tmp/claude-501/-Users-asulbaran21-Personal-Projects-Personal-Website-aaron-portfolio-website--claude-worktrees-distracted-moser-bfd850/951f84c4-f283-4b9b-a790-0845884484f3/scratchpad/onboarding-research/synthesis.md`.

## Global Constraints

- All copy in `lib/content/speedrun.ts`; components never embed strings. No em dashes anywhere (copy, comments, commits). Act 2 copy in their voice (lowercase headlines, Title Case buttons where theirs are); Act 1 copy is Aaron's and is not edited.
- Tokens only: colors are CSS custom properties (`--sr-*` under `[data-speedrun]` in `app/globals.css`, mapped in `tailwind.config.ts`); no hex in components; no pure `#000` or `#FFF`.
- Components under about 200 lines; split before growing past that.
- Reduced motion (`prefersReducedMotion()` in `lib/speedrun/motion.ts`, and `motion-reduce:` utilities) gets no slide, cascade or sweep: plain fades or instant swaps.
- The visitor's name never appears in any request body (match, read, brief). It lives in client state only.
- Phases change on a button, a tap or Enter, never on wheel or swipe; no `preventDefault` on wheel or touch; the URL never changes.
- Motion values (spec section 3): step enter 360ms `cubic-bezier(.22,.61,.36,1)` from 14px (forward) or -14px (back), no exit; card entrance 320ms `cubic-bezier(.4,0,.2,1)` from 14px; phase exit 240ms ease to -14px and opacity 0; cascade 420ms `cubic-bezier(.16,1,.3,1)` from translateY(10px) scale(.99), 60ms apart; progress width 480ms `cubic-bezier(.16,1,.3,1)`; choice advance 260ms; switch cover 480ms, hold 120ms, reveal 560ms, band 28vw; reduced fade 240ms out, 180ms in; chip select sweep 320ms `cubic-bezier(.2,.7,.3,1)` with the text color 140ms after 100ms and a 250ms scale pulse.
- Git: stage files by name, never `git add -A` or `git add .` (`docs/content/` is private and untracked). Small commits, each ending with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (implementers credit their own model). Never push, merge or deploy.
- Processes: never start `pnpm dev`; verify with `pnpm build && pnpm start -p <your port>` only when a step says so, keep the PID from `$!` in your shell, stop only that PID, never `pkill`/`killall`/pattern kills, never touch ports 3000, 3210, 3220, 3221, 3276. At most one Playwright run per implementer, and only in Task 7.
- Never set `SPEEDRUN_AI=on` without `AI_GATEWAY_API_KEY=dummy` in the same command (a real token gets minted otherwise).
- Checks before every commit: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` (vitest). All green.

## Review Focus

1. Double activation of the switch (double click, Enter held, click during the cover): the sweep runs once and the page lands on join once. Pinned in Task 3 (shift reducer test plus e2e in Task 7).
2. Start over or Replay from the top while a match request is in flight: the stale response never lands on the fresh flow. Pinned in Task 1 (`built` ignored unless the build id matches) and Task 7 (e2e).
3. Odd names: whitespace only is invalid; 41 characters are cut to 40; markup-like text renders as text; leading and trailing spaces are trimmed in every greeting. Pinned in Task 1 (unit) and Task 5 (render through React text only).
4. Choice races: tapping Yes then No within 260ms advances once, on the last answer; pressing Back during the 260ms cancels the advance. Pinned in Task 4 (hook test with fake timers).
5. Student flipped yes, then back, then no: the arrangements step leaves the list, the answers drop `arrangements`, the intake drops `seniority`, and the counter returns to 07. Pinned in Task 1 (unit).

---

### Task 1: The phase and onboarding model (pure)

**Files:**
- Create: `lib/speedrun/phase.ts`, `lib/speedrun/phase.test.ts`
- Create: `lib/speedrun/onboarding.ts`, `lib/speedrun/onboarding.test.ts`
- Modify: `lib/speedrun/types.ts` (Intake), `lib/speedrun/demoState.ts`, `lib/speedrun/demoState.test.ts`
- Modify (only to keep the build compiling): `components/speedrun/act2/JoinCard.tsx`, `components/speedrun/SpeedrunDemo.tsx` (minimal: use the new answer and step shapes; they are rewritten later)

**Interfaces:**
- Produces, in `lib/speedrun/types.ts`: `Intake = { targets: Fn[]; places: string[]; why: string; seniority?: "intern" | "new_grad"; founding?: boolean }`.
- Produces, in `lib/speedrun/phase.ts`:
  - `type Phase = "opener" | "join" | "building" | "network"`; `type NetworkTab = "matches" | "board" | "brief" | "decisions"`; `const NETWORK_TABS: readonly NetworkTab[]` in that order.
  - `type PhaseState = { phase: Phase; tab: NetworkTab }`; `const INITIAL_PHASE: PhaseState = { phase: "opener", tab: "matches" }`.
  - `type PhaseEvent = { type: "enterJoin" } | { type: "build" } | { type: "buildFailed" } | { type: "logDone" } | { type: "tab"; tab: NetworkTab } | { type: "startOver" } | { type: "replayTop" }`.
  - `phaseReducer(state: PhaseState, event: PhaseEvent): PhaseState`: enterJoin only from opener; build only from join; buildFailed only from building, back to join; logDone only from building, to network with tab matches; tab only in network; startOver from any phase but opener to join (tab matches); replayTop from anywhere to opener (tab matches). Anything else returns the same object.
- Produces, in `lib/speedrun/onboarding.ts`:
  - `type StepKey = "name" | "targets" | "student" | "arrangements" | "places" | "founding" | "why" | "resume"`.
  - `type Arrangement = "between" | "during" | "whileInSchool" | "afterGrad"`; `const ARRANGEMENTS: readonly Arrangement[]` in that order (A to D).
  - `type Answers = { name: string; targets: Fn[]; student: boolean | null; arrangements: Arrangement[]; places: string[]; founding: boolean | null; why: string }`; `const EMPTY_ANSWERS: Answers`; `const NAME_MAX = 40`.
  - `stepsFor(answers: Answers): StepKey[]`: `["name","targets","student","places","founding","why","resume"]`, with `"arrangements"` inserted after `"student"` when `answers.student === true`.
  - `cleanName(raw: string): string`: trims, collapses inner whitespace runs to one space, cuts to `NAME_MAX`.
  - `isStepValid(step: StepKey, answers: Answers, ctx: { resumeChosen: boolean }): boolean`: name needs `cleanName(name).length >= 1`; targets at least one; student and founding a non-null boolean; arrangements at least one; places and why always valid; resume needs `ctx.resumeChosen`.
  - `seniorityFor(answers: Answers): Intake["seniority"]`: undefined unless `student === true`; `"new_grad"` if arrangements include `whileInSchool` or `afterGrad`; `"intern"` if arrangements are non-empty otherwise; undefined when empty.
  - `toIntake(answers: Answers): Intake`: targets, places, why; `seniority` only when defined; `founding: true` only when `answers.founding === true`. Never a name.
  - `displayName(answers: Answers, personFirstName: string | null, fallback: string): string`: `cleanName(answers.name)` if non-empty, else `personFirstName`, else `fallback`.
- Produces, in `lib/speedrun/demoState.ts`: `DemoState.answers: Answers` (replaces the old Intake answers); `DemoState.joinStep: number` (an index into `stepsFor(state.answers)`); `DemoState.buildId: number`; the `"answer"` action takes `patch: Partial<Answers>` and, when `student` becomes anything but true, clears `arrangements` and clamps `joinStep` into the new step list; `"next"` and `"back"` clamp to the step list; `"pickPerson"`, `"uploaded"` and `"reset"` bump `buildId`; `"built"` carries `buildId: number` and applies only when `state.step === "building"` and the ids match; `intake` is `toIntake(answers)` when the visitor gave any answer the match uses (targets, places, why, student, founding), else the picked person's intake.

- [ ] **Step 1: Write the failing tests**

In `lib/speedrun/onboarding.test.ts`:
- `stepsFor(EMPTY_ANSWERS)` equals the seven keys above; with `student: true` it has eight, `"arrangements"` at index 3.
- `cleanName("  Alex   Rivera ")` is `"Alex Rivera"`; `cleanName("   ")` is `""`; a 41-character name comes back 40 long; `cleanName("<b>Al</b>")` is returned unchanged (rendering escapes it).
- `isStepValid("name", { ...EMPTY_ANSWERS, name: "   " }, ctx)` is false; `"Al"` is true. `"student"` with null is false, with false is true. `"resume"` follows `ctx.resumeChosen`. `"places"` and `"why"` are true when empty.
- `seniorityFor`: non-student with arrangements is undefined; student with `["between"]` is `"intern"`; with `["during","afterGrad"]` is `"new_grad"`; with `["whileInSchool"]` is `"new_grad"`; student with `[]` is undefined.
- `toIntake({ ...EMPTY_ANSWERS, name: "Alex", targets: ["product"], founding: true })` has no `name` key, `JSON.stringify` of it does not contain `"Alex"`, and `founding` is true; with `founding: false` the key is absent.
- `displayName({ ...EMPTY_ANSWERS, name: " Alex " }, "Sam", "you")` is `"Alex"`; empty name gives `"Sam"`; empty name and null gives `"you"`.

In `lib/speedrun/phase.test.ts`: every legal transition from the Interfaces block; `enterJoin` from join returns the same object; `build` from opener returns the same object; `logDone` lands on tab matches; `tab` outside network is ignored; `startOver` from network lands on join with tab matches; `replayTop` from building lands on opener.

In `lib/speedrun/demoState.test.ts` (extend; keep every existing passing case that still applies):
- answering `student: true` then moving to step index 4, then answering `student: false`, leaves `arrangements` empty, `stepsFor` seven long, `joinStep` at most 6, and `state.intake.seniority` undefined.
- `"built"` with a stale `buildId` after `"reset"` leaves `profile` and `result` null and `step` at join.
- `"built"` while `step` is join is ignored.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run lib/speedrun/onboarding.test.ts lib/speedrun/phase.test.ts lib/speedrun/demoState.test.ts`
Expected: FAIL (missing modules, then failing assertions).

- [ ] **Step 3: Implement `lib/speedrun/onboarding.ts`, `lib/speedrun/phase.ts`, the Intake change and the demoState changes** per the Interfaces block. Keep `MAX_PLACES` and the board actions as they are. Update `JoinCard.tsx` and `SpeedrunDemo.tsx` just enough to compile (the step keys now come from `stepsFor`; the fetch passes `buildId` back on `"built"`).

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run lib/speedrun && pnpm tsc --noEmit && pnpm lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/speedrun/phase.ts lib/speedrun/phase.test.ts lib/speedrun/onboarding.ts lib/speedrun/onboarding.test.ts lib/speedrun/types.ts lib/speedrun/demoState.ts lib/speedrun/demoState.test.ts components/speedrun/act2/JoinCard.tsx components/speedrun/SpeedrunDemo.tsx
git commit -m "Speedrun page: a pure phase and onboarding model, with the name kept out of the intake"
```

---

### Task 2: The two intake fields reach ranking, the routes and the build log; no name in any request

**Files:**
- Modify: `lib/speedrun/match.ts`, `lib/speedrun/match.test.ts`
- Modify: `lib/speedrun/matchHandler.ts`, `lib/speedrun/readHandler.ts` (+ their tests)
- Modify: `lib/speedrun/readClient.ts`, `lib/speedrun/readClient.test.ts`
- Modify: `lib/speedrun/buildLog.ts`, `lib/speedrun/buildLog.test.ts`, `lib/content/speedrun.ts` (build lines only)
- Create: `lib/speedrun/requests.ts`, `lib/speedrun/requests.test.ts`

**Interfaces:**
- Consumes: `Intake` with `seniority?` and `founding?` (Task 1); `toIntake` (Task 1).
- Produces:
  - `rankMatches(profile, intake, snapshot)` unchanged in signature; it ranks with `intake.seniority ?? profile.seniority` everywhere it used `profile.seniority`, and returns founder `routes` when `intake.founding === true || profile.founderSignal.score >= 0.6`.
  - Both route schemas accept `seniority: z.enum(["intern", "new_grad"]).optional()` and `founding: z.boolean().optional()` inside `intake`.
  - `lib/speedrun/requests.ts`: `matchRequestBody(intake: Intake, personKey: PersonKey): string` (the JSON the client posts, with places capped at `MAX_PLACES`). The client fetch in the demo uses it.
  - `postResume(file: File, intake: Intake)` (its second argument is now an `Intake`, never the answers).
  - `composeBuildLog(intake: Intake, profile: Profile, result: MatchResult, who: { name: string; sampleOwner: string | null }): BuildLine[]`: the made-for line uses `who.name`; when `who.sampleOwner` is non-null and differs from `who.name`, one extra read line, `speedrunCopy.build.lines.sample(owner)` = `` `read ${owner}'s sample resume` ``, comes first.

- [ ] **Step 1: Write the failing tests**
- `match.test.ts`: Sam's profile with `intake.seniority: "intern"` ranks an intern role that his own seniority would filter out; with `seniority` absent the result equals today's. Maya's profile (low founder score) with `founding: true` returns the founder routes; without it, none.
- `matchHandler` and `readHandler` tests: a body with `seniority: "intern", founding: true` parses; `seniority: "senior"` is a 400 / bad_input; extra unknown keys (including `name`) are stripped by zod and never reach `rankMatches` (assert the parsed intake has no `name`).
- `requests.test.ts`: `matchRequestBody(toIntake({ ...EMPTY_ANSWERS, name: "Zelda Quinn", targets: ["ai"] }), "sam")` does not contain `"Zelda"`; nine places come out as eight.
- `readClient.test.ts`: with a stubbed `fetch`, `postResume(file, toIntake(answersWithName))` sends a body without the name string.
- `buildLog.test.ts`: `who: { name: "Alex", sampleOwner: "Sam" }` makes the first line `read Sam's sample resume` and the made-for line name Alex; `who: { name: "Sam", sampleOwner: "Sam" }` has no sample line.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run lib/speedrun/match.test.ts lib/speedrun/matchHandler.test.ts lib/speedrun/readHandler.test.ts lib/speedrun/readClient.test.ts lib/speedrun/buildLog.test.ts lib/speedrun/requests.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block. In `rankMatches`, derive one effective profile at the top (`intake.seniority ? { ...profile, seniority: intake.seniority } : profile`) and use it throughout. Update the demo's fetch and upload calls to `matchRequestBody` and `postResume(file, toIntake(state.answers))`, and its `composeBuildLog` call (name from `displayName`, sample owner from the picked person's first name).

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run lib/speedrun && pnpm tsc --noEmit && pnpm lint`
Expected: all pass, including `classify.battery.test.ts` and `extract.battery.test.ts` unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/speedrun/match.ts lib/speedrun/match.test.ts lib/speedrun/matchHandler.ts lib/speedrun/matchHandler.test.ts lib/speedrun/readHandler.ts lib/speedrun/readHandler.test.ts lib/speedrun/readClient.ts lib/speedrun/readClient.test.ts lib/speedrun/buildLog.ts lib/speedrun/buildLog.test.ts lib/speedrun/requests.ts lib/speedrun/requests.test.ts lib/content/speedrun.ts components/speedrun/SpeedrunDemo.tsx
git commit -m "Speedrun page: student and founding answers reach ranking and both routes; requests carry no name"
```
(Stage only the test files that exist.)

---

### Task 3: The phase shell, motion constants and the switch landing on a phase

**Files:**
- Create: `components/speedrun/SpeedrunExperience.tsx`, `components/speedrun/useDemoBuild.ts`, `components/speedrun/usePhaseChange.ts`
- Create: `components/speedrun/phases/JoinPhase.tsx`, `components/speedrun/phases/BuildingPhase.tsx`, `components/speedrun/phases/NetworkPhase.tsx` (thin wrappers around today's components; Tasks 4 and 5 rewrite them)
- Create: `lib/speedrun/tuning.ts`, `lib/speedrun/tuning.test.ts`
- Modify: `lib/speedrun/motion.ts`, `lib/speedrun/shift.ts` (+ `lib/speedrun/shift.test.ts` if present), `components/speedrun/Shift.tsx`, `components/speedrun/SrZone.tsx`, `app/speedrun/page.tsx`, `lib/content/speedrun.ts` (phase announcements)
- Delete: `components/speedrun/SpeedrunDemo.tsx` (its logic moves to `useDemoBuild`)

**Interfaces:**
- Consumes: `phaseReducer`, `INITIAL_PHASE`, `PhaseEvent` (Task 1); `demoReducer`, `matchRequestBody`, `postResume`, `composeBuildLog`, `displayName` (Tasks 1 and 2).
- Produces:
  - `lib/speedrun/motion.ts`: `type Motion = { coverMs; holdMs; revealMs; bandVw; fadeOutMs; fadeInMs; cascadeMs; cascadeStaggerMs; cardInMs; cardInPx; phaseExitMs; stepMs; stepPx; choiceAdvanceMs; progressMs; submittingMs; chipSweepMs }` (all numbers), `const MOTION: Motion` with the Global Constraints values and `submittingMs: 700`, `chipSweepMs: 320`; easing constants `SR_EASE` (kept), `STEP_EASE = "cubic-bezier(.22,.61,.36,1)"`, `CARD_EASE = "cubic-bezier(.4,0,.2,1)"`, `COVER_EASE = "cubic-bezier(.7,0,.84,0)"`, `CHIP_EASE = "cubic-bezier(.2,.7,.3,1)"`; `motion(): Motion` (MOTION merged with tuning overrides). `SHIFT_MS` is removed; its users read `motion()`.
  - `lib/speedrun/tuning.ts`: `setMotionOverrides(patch: Partial<Motion>): void`, `resetMotionOverrides(): void`, `getMotionOverrides(): Partial<Motion>`, `subscribeMotion(listener: () => void): () => void`.
  - `components/speedrun/Shift.tsx` exports `Switch({ onCovered, onRevealStart }: { onCovered: () => void; onRevealStart: () => void })`: the turn lines and the button (no Replay button), and the cover strip. Click plays cover, calls `onCovered()` (the parent dispatches `enterJoin` and scrolls to the top instantly), holds, calls `onRevealStart()`, reveals. Reduced motion: fade `#main` out, `onCovered()`, fade in, `onRevealStart()`. A second click while busy does nothing (the shift reducer already ignores `go` unless idle; keep that test).
  - `components/speedrun/SrZone.tsx`: `SrZone({ active }: { active: boolean })` sets or removes `html[data-sr-zone]`; removed on unmount.
  - `SpeedrunExperience({ opener, live, stats, themeClassName }: { opener: ReactNode; live: Live; stats: DemoStats; themeClassName: string })`: owns `phaseReducer` and `demoReducer`; renders exactly one phase; the opener phase is `<section data-act="1">` with `{opener}` and `<Switch>`; every other phase sits in `<section id="act-2" data-speedrun="" data-phase={phase} className={themeClassName + " ..."}>` with `<PinnedAffiliation />` (or `<Affiliation variant="pinned" />` as today). `Switch`'s strip stays mounted across the change (render it outside the phase branch).
  - `usePhaseChange(dispatchPhase)` returns `go(event: PhaseEvent)`: unless reduced motion, animates the current `[data-phase-frame]` out (`phaseExitMs`, ease, to translateY(-14px) opacity 0) and then dispatches; after any phase change, `window.scrollTo({ top: 0, behavior: "instant" })`, focus moves to the new phase's `[data-phase-heading]` (`preventScroll`), and an `aria-live` line reads `speedrunCopy.phases.announce[phase]`.
  - Every phase component renders its root as `<div data-phase-frame="">` and one heading with `data-phase-heading tabIndex={-1}`, and plays the card entrance (`cardInMs`, `CARD_EASE`, from `cardInPx`) on mount. The one exception is JoinPhase arriving by the switch: it mounts hidden under the cover and runs its cascade when `arrivalKey` changes (see below).
  - `JoinPhase({ state, dispatch, stats, onBuild, onSkip, arrivalKey })`: today's `Hero` and `JoinCard`; when `arrivalKey` changes it cascades the hero's `[data-cascade]` children (`cascadeMs`, `SR_EASE`, `cascadeStaggerMs` apart) and enters the card last. `onBuild()` is what the card's finish calls; `onSkip()` is the hero's ghost button.
  - `BuildingPhase({ state, lines, failed, onRetry, onDone })` and `NetworkPhase({ state, dispatch, tab, onTab, onStartOver, onReplayTop, focusHeading })`: today's components, stacked as today, plus two plain buttons (Start over, Replay from the top) in NetworkPhase so the resets work before Task 5.
  - `useDemoBuild(state, dispatch, onFailed: () => void)`: today's `SpeedrunDemo` effects (match fetch with abort, upload, retry, the build log lines) moved into a hook; an upload failure calls `onFailed()` (the experience dispatches `buildFailed`).
  - `app/speedrun/page.tsx`: `<main id="main">`, `<BotIdClient protect={BOT_PROTECTED} />`, and `<SpeedrunExperience opener={<><Opener /><AaronFunnel /></>} live={liveFlags()} stats={stats} themeClassName={`${srSans.variable} ${srCond.variable} bg-sr-bg font-srsans text-sr-ink`} />`. `Decisions` and `Close` move inside NetworkPhase.

- [ ] **Step 1: Write the failing tests**
- `tuning.test.ts`: `motion()` equals `MOTION` by default; after `setMotionOverrides({ coverMs: 300 })` it returns 300 and leaves the rest; `resetMotionOverrides()` restores; a subscriber is called on each set and reset; unsubscribing stops calls.
- `shift.test.ts` (create if absent): `go` from covering, covered or revealing returns the same state (the double-activation guard).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run lib/speedrun/tuning.test.ts lib/speedrun/shift.test.ts`
Expected: FAIL on the tuning module.

- [ ] **Step 3: Implement** per the Interfaces block. Keep the approved sweep's look exactly (cover from the right in the accent color, the held line, the reveal to the left trailing `BAND_BG`); only its landing changes. Keep `components/speedrun/Shift.tsx` under 200 lines by moving the Web Animations into a helper in the same folder if needed.

- [ ] **Step 4: Run the checks and a production build**

Run: `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: all pass. Then `pnpm start -p 3290 & SERVER=$!`, `curl -s localhost:3290/speedrun | grep -c 'data-act="1"'` prints 1 and `grep -c 'id="act-2"'` prints 0 (only the opener is server-rendered), then `kill $SERVER`.

- [ ] **Step 5: Commit**

```bash
git add components/speedrun/SpeedrunExperience.tsx components/speedrun/useDemoBuild.ts components/speedrun/usePhaseChange.ts components/speedrun/phases lib/speedrun/tuning.ts lib/speedrun/tuning.test.ts lib/speedrun/motion.ts lib/speedrun/shift.ts lib/speedrun/shift.test.ts components/speedrun/Shift.tsx components/speedrun/SrZone.tsx app/speedrun/page.tsx lib/content/speedrun.ts
git rm components/speedrun/SpeedrunDemo.tsx
git commit -m "Speedrun page: one phase on screen at a time, and the switch lands on the join instead of scrolling"
```

---

### Task 4: The join phase in their anatomy

**Files:**
- Modify: `components/speedrun/phases/JoinPhase.tsx`, `components/speedrun/act2/Hero.tsx`, `components/speedrun/act2/JoinCard.tsx`, `components/speedrun/act2/Chip.tsx`, `components/speedrun/act2/PeoplePicker.tsx` (only if needed), `app/globals.css` (the chip sweep), `lib/content/speedrun.ts` (join section)
- Create: `components/speedrun/act2/JoinStep.tsx`, `components/speedrun/act2/ChoicePills.tsx`, `components/speedrun/act2/ArrangementCards.tsx`, `components/speedrun/act2/useChoiceAdvance.ts` (a thin hook), `lib/speedrun/choiceAdvance.ts` and `lib/speedrun/choiceAdvance.test.ts` (vitest only picks up `lib/**/*.test.ts`)

**Interfaces:**
- Consumes: `stepsFor`, `isStepValid`, `ARRANGEMENTS`, `cleanName`, `NAME_MAX` (Task 1); `motion()`, `STEP_EASE`, `CHIP_EASE` (Task 3); `JoinPhase` props (Task 3).
- Produces:
  - `Hero({ stats, onSkip, compact }: { stats: DemoStats; onSkip: () => void; compact: boolean })`: eyebrow, headline, lede, stat tiles and the ghost "Skip the questions: see Sam's board" button, each marked `data-cascade`; `compact` (below `lg`) shows eyebrow and headline only. Its old primary CTA is gone (the card is right there).
  - JoinPhase layout: `lg:grid lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-12` with the hero left and the card right; below `lg`, compact hero then card, the card's first question visible at 390 by 844 without scrolling.
  - `JoinCard({ state, dispatch, onBuild, onUpload })`: header row (logo, `copy.label`, counter `NN / NN` from `stepsFor(state.answers).length`, a "Start over" text button that dispatches `reset`), the 8px progress track whose fill is `(joinStep + 1) / total` wide with `transition: width {progressMs}ms {SR_EASE}` and `backgroundImage: var(--sr-grad-accent)`, the purple `NN →` eyebrow, `<JoinStep>`, the footer (ghost Back disabled on step 0, Continue disabled until `isStepValid`, "Press Enter ↵", the nothing-sent line, inline affiliation). On the last step Continue reads `copy.finish` ("Build my network"); pressing it shows the submitting stage (`copy.submitting(name)` = `` `Building your network, ${name}.` ``) for `submittingMs`, then calls `onBuild()`.
  - Step change: the step body remounts keyed by step key and direction and plays the enter animation (`stepMs`, `STEP_EASE`, from `stepPx` or `-stepPx`); no exit. Focus lands on the step's first control (the name input, the first chip, the first pill, the first card, the place input, the why input, the first person).
  - `ChoicePills({ value, onChoose, labels })` for student and founding: two radio buttons in a `radiogroup`, their pill style (radius full, 13px 28px padding, condensed uppercase, 1px border, selected and hover black fill with light text, `.12s`). Choosing calls `onChoose(value)` at once; `useChoiceAdvance` advances `choiceAdvanceMs` later. A footer note reads `copy.tapAdvances` ("Single tap advances, no Continue click.").
  - `createChoiceAdvance(advance: () => void, delayMs: number): { schedule(): void; cancel(): void }` in `lib/speedrun/choiceAdvance.ts`: a second `schedule` within the delay restarts the timer (one advance, on the last answer); `cancel` stops it. `useChoiceAdvance(advance, delayMs)` wraps it and cancels on unmount; Back calls `cancel`.
  - `ArrangementCards({ value, onToggle })`: lettered A to D cards (letter becomes a check when picked), `.18s` transitions, selected black fill.
  - `Chip` selection uses a `.sr-chip` class in `app/globals.css` (under `[data-speedrun]`): a `linear-gradient(-75deg, ...)` built from `--sr-*` tokens at `background-size: 250%`, animating `background-position` over 320ms `CHIP_EASE`, the text color over 140ms after 100ms, and a 250ms scale pulse; `motion-reduce` keeps only the color change.
  - Copy (`lib/content/speedrun.ts`, `join`): questions and helpers per spec section 4 (name: "What should we call you?", placeholder "First name", helper on staying in the browser; targets: "What are you looking for?", helper "Select any that apply."; student: "Are you a full-time student?"; arrangements: "What kind of work?" with the four labels; places: "Where do you want to work?"; founding: "Are you considering or in the process of founding?"; why: "Anything founders should know?"; resume: "Help founders match you faster."), `yes`/`no`, `startOver`, `tapAdvances`, `finish: "Build my network"`, `submitting(name)`, `skip: "Skip the questions: see Sam's board"`.

- [ ] **Step 1: Write the failing test** in `lib/speedrun/choiceAdvance.test.ts` with fake timers: one `schedule` advances once after 260ms; two schedules 100ms apart advance once, 260ms after the second; `cancel` within the delay advances never.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/speedrun/choiceAdvance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block. Enter on a text step advances when valid (the place input keeps today's rule: Enter with typed text adds the place). Keep the `aria-live` line: `Step N of M.` plus the question.

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add components/speedrun/phases/JoinPhase.tsx components/speedrun/act2/Hero.tsx components/speedrun/act2/JoinCard.tsx components/speedrun/act2/JoinStep.tsx components/speedrun/act2/ChoicePills.tsx components/speedrun/act2/ArrangementCards.tsx components/speedrun/act2/useChoiceAdvance.ts lib/speedrun/choiceAdvance.ts lib/speedrun/choiceAdvance.test.ts components/speedrun/act2/Chip.tsx app/globals.css lib/content/speedrun.ts
git commit -m "Speedrun page: the join in their anatomy, one question per screen, with Start over and the student branch"
```
(Add `PeoplePicker.tsx` by name only if it changed.)

---

### Task 5: The building and network phases

**Files:**
- Modify: `components/speedrun/phases/BuildingPhase.tsx`, `components/speedrun/phases/NetworkPhase.tsx`, `components/speedrun/act2/FounderRoute.tsx`, `components/speedrun/act2/Matches.tsx` (founding prop), `components/speedrun/act2/BriefPreview.tsx` (name prop), `lib/content/speedrun.ts` (build, network, matches.founder, brief greeting)
- Create: `components/speedrun/act2/NetworkTabs.tsx`, `components/speedrun/act2/NetworkHeader.tsx`

**Interfaces:**
- Consumes: `NETWORK_TABS`, `NetworkTab` (Task 1); `displayName` (Task 1); `motion()`, `STEP_EASE` (Task 3); the phase props (Task 3).
- Produces:
  - `BuildingPhase`: a heading (`copy.build.heading(name)`) and today's `BuildLog` full width; `onDone(skipped)` fires `logDone`; failure shows today's retry.
  - `NetworkHeader({ name, onStartOver, onReplayTop })`: `copy.network.heading(name)` = `` `You're in the network, ${name}.` `` as the phase heading, the tag `copy.network.tag` ("✓ Built for you"), one line `copy.network.next`, and two text buttons right-aligned: `copy.network.startOver` ("Start over") and `copy.network.replayTop` ("Replay from the top").
  - `NetworkTabs({ tab, onTab })`: a `role="tablist"` of frosted pills (selected: black fill, light text), labels from `copy.network.tabs`; Left and Right arrows move between tabs, Home and End jump; each tab button has `aria-controls` its panel.
  - NetworkPhase: header, tabs, then one `role="tabpanel"` keyed by tab with the step enter animation (`stepMs`, `STEP_EASE`, `stepPx`); panels: Matches (today's, `focusHeading` as today), Board, Brief (`BriefPreview` with `name`), Decisions. Each panel ends with a "Next: ..." button (`copy.network.nextTo[tab]`) to the following tab; Decisions has none. Under the panel on every tab: `Close` and `Egg`.
  - Founder card: `FounderRoute({ routes, mentioned })` shows `copy.matches.founder.mentioned` ("You mentioned founding.") as its title when `mentioned` (the visitor answered yes), its usual title otherwise.
  - `BriefPreview({ state, name })`: the in-page greeting uses `name`; the sent email (BriefSend, brief route) is unchanged and carries no name.

- [ ] **Step 1: Write the failing test**: in `lib/speedrun/phase.test.ts`, a pure helper `nextTab(tab: NetworkTab): NetworkTab | null` (add to `lib/speedrun/phase.ts`): matches to board, board to brief, brief to decisions, decisions to null.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/speedrun/phase.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block. Names render as React text only (never `dangerouslySetInnerHTML`).

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add components/speedrun/phases/BuildingPhase.tsx components/speedrun/phases/NetworkPhase.tsx components/speedrun/act2/NetworkTabs.tsx components/speedrun/act2/NetworkHeader.tsx components/speedrun/act2/FounderRoute.tsx components/speedrun/act2/Matches.tsx components/speedrun/act2/BriefPreview.tsx lib/speedrun/phase.ts lib/speedrun/phase.test.ts lib/content/speedrun.ts
git commit -m "Speedrun page: the build and your network as phases, with tabs and both resets"
```

---

### Task 6: The dev-only motion tuning panel

**Files:**
- Create: `components/speedrun/TuningPanel.tsx`, `lib/speedrun/tuningPresets.ts`, `lib/speedrun/tuningPresets.test.ts`
- Modify: `components/speedrun/SpeedrunExperience.tsx` (mount it), `lib/content/speedrun.ts` (panel labels)

**Interfaces:**
- Consumes: `Motion`, `MOTION`, `setMotionOverrides`, `resetMotionOverrides`, `subscribeMotion` (Task 3); the experience's `replayTop` and the switch.
- Produces:
  - `lib/speedrun/tuningPresets.ts`: `TUNING_PRESETS: { name: string; values: Motion }[]`, first "Approved sweep" (= `MOTION`), then "Snappy" (coverMs 360, holdMs 80, revealMs 420, cascadeStaggerMs 40, stepMs 280, cardInMs 260, the rest as `MOTION`); `motionJson(values: Motion): string` (flat, two-space indented JSON, keys in `MOTION` order); `TUNING_RANGES: Record<keyof Motion, { min: number; max: number; step: number }>`.
  - `TuningPanel`: its root carries `data-tuning-panel`; it is loaded only when `process.env.NODE_ENV === "development"` and the URL has `?tune` (a `next/dynamic` import inside that branch, so production bundles never include it); a collapsible fixed panel (z 45, under modals) with a slider per key, the preset buttons (recommended first), "Replay the switch" (back to the opener, then plays the switch), "Reset" and "Copy values" (copies `motionJson`).

- [ ] **Step 1: Write the failing tests**: the first preset's values equal `MOTION`; "Snappy" differs only in its six keys; `motionJson(MOTION)` parses back to `MOTION` and lists keys in `MOTION` order; every `MOTION` value sits inside its `TUNING_RANGES` entry.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run lib/speedrun/tuningPresets.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block.

- [ ] **Step 4: Run the checks and confirm the panel is absent from production**

Run: `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build && ! grep -rl "data-tuning-panel" .next/static`
Expected: all pass; the grep finds nothing.

- [ ] **Step 5: Commit**

```bash
git add components/speedrun/TuningPanel.tsx lib/speedrun/tuningPresets.ts lib/speedrun/tuningPresets.test.ts components/speedrun/SpeedrunExperience.tsx lib/content/speedrun.ts
git commit -m "Speedrun page: a dev-only panel to tune the switch and step motion by hand"
```

---

### Task 7: e2e for the phased flow

**Files:**
- Create: `e2e/speedrun-flow.ts` (helpers)
- Modify: `e2e/speedrun.spec.ts`, `e2e/speedrun-board.spec.ts`, `e2e/speedrun-brief.spec.ts`, `e2e/speedrun-matches.spec.ts`, `e2e/speedrun-upload.spec.ts`, `e2e/speedrun-egg.spec.ts`

**Interfaces:**
- Consumes: the copy keys from Tasks 3 to 5; the `data-phase`, `data-phase-heading`, `data-phase-frame` attributes.
- Produces, in `e2e/speedrun-flow.ts`: `playSwitch(page)`, `answerOnboarding(page, opts: { name?: string; targets?: string[]; student?: boolean; arrangements?: string[]; places?: string[]; founding?: boolean; why?: string; person?: "maya" | "ravi" | "sam" | "lena" | "dev"; connectGmail?: boolean })` (defaults: name "Alex", targets product, student false, founding false, person sam), `skipToSam(page)`, `skipBuildLog(page)`, `openTab(page, label: string)`.

- [ ] **Step 1: Write the specs** (they fail until the helpers exist):
  - `speedrun.spec.ts`: the opener shows first and no `[data-speedrun]` phase is in the DOM; clicking the switch lands on the join with `window.scrollY === 0` and the name input focused; a double click on the switch still lands once (one `[data-phase="join"]`); the full path with `student: true` shows the counter `03 / 07` before the student answer and `04 / 08` after, then builds and shows `You're in the network, Alex.`; the four tabs switch with the arrow keys; Start over returns to step 1 with an empty name; Replay from the top returns to the opener; keyboard only (Tab, Enter, Space) completes the flow; no request body sent during the flow contains the typed name (collect `page.on("request")` post data); Start over pressed during the build lands on a clean step 1 and the stale result never appears; reduced motion completes the switch with no `[data-shift-strip]` animation.
  - The board, brief, matches, upload and egg specs: replace each local `reach` helper with the shared helpers; keep every assertion that still applies; Act 1 checks in the egg spec now use the opener phase.
- [ ] **Step 2: Run them to see them fail**, against your own ports: `E2E_FULL_PORT=3152 E2E_HOLDING_PORT=3153 CI=1 pnpm test:e2e e2e/speedrun` after confirming with `lsof -ti :3152 -sTCP:LISTEN` and `:3153` that both are free.
- [ ] **Step 3: Implement the helpers** and fix any spec that fails for a reason in the specs themselves. A failure that points at product code is reported back, not patched around.
- [ ] **Step 4: Run the speedrun specs green** with the same command. The upload spec needs an AI build: run it alone with `SPEEDRUN_AI=on AI_GATEWAY_API_KEY=dummy` set for that build, as it does today.
- [ ] **Step 5: Commit**

```bash
git add e2e/speedrun-flow.ts e2e/speedrun.spec.ts e2e/speedrun-board.spec.ts e2e/speedrun-brief.spec.ts e2e/speedrun-matches.spec.ts e2e/speedrun-upload.spec.ts e2e/speedrun-egg.spec.ts
git commit -m "Speedrun page: e2e for the phased flow, both resets and the name never leaving the page"
```

---

### Task 8: Keep their snapshot and logos out of the public mirror (board D21, added 2026-11-08)

Aaron's answer on D21 ("Site only"): the private site keeps the real snapshot and every logo; the public mirror ships a made-up stand-in instead.

**Files:**
- Create: `lib/speedrun/snapshot.public.json` (a made-up stand-in, about 8 fictional companies and 20 roles, every name invented and checked not to be a real company), `public/speedrun/standin/*.svg` (simple placeholder marks, one per stand-in company, drawn from initials; no real logos), `lib/speedrun/snapshot.public.test.ts`
- Modify: `scripts/public-repo/public-export.json`, `lib/speedrun/snapshot.ts` (export `snapshotSchema` if it is private)

**Interfaces:**
- Produces: `snapshotSchema` exported from `lib/speedrun/snapshot.ts` (unchanged shape).
- Export config:
  - Deny `lib/speedrun/snapshot.json` and `public/speedrun/companies/**`. Deny wins over the existing `lib/speedrun/**` and `public/speedrun/**` allows; read `scripts/public-repo/filter_rules.py` for the precedence.
  - Add a `rename` entry mapping `lib/speedrun/snapshot.public.json` to `lib/speedrun/snapshot.json`, so the mirror's `getSnapshot()` loads the stand-in with no code change.
  - Keep `public/speedrun/speedrun-logo.svg` allowed.
  - Every new path has a rule.
- Stand-in data:
  - Every `logo` field points at `/speedrun/standin/<slug>.svg`.
  - The data includes at least one role per function in `FNS`, interns and new-grad roles, one founding role, and one company with `slug` "speedrun" (the fund itself, as the real snapshot has).
  - `fetchedAt` is an ISO date.

- [ ] **Step 1: Write the failing test** `lib/speedrun/snapshot.public.test.ts`:
  - `snapshotSchema.safeParse` of the stand-in succeeds.
  - No stand-in company name or slug appears in the real `snapshot.json`.
  - Every `logo` path has a matching file under `public/speedrun/standin/`.
  - `rankMatches` with Sam's profile and intake over the stand-in returns at least one match. This keeps the mirror's demo usable.
- [ ] **Step 2: Run it to see it fail.**
  Run: `pnpm vitest run lib/speedrun/snapshot.public.test.ts`.
  Expected: FAIL.
- [ ] **Step 3: Implement** the stand-in, the marks and the export rules.
- [ ] **Step 4: Verify the export.**
  - Run `pnpm vitest run && pnpm tsc --noEmit && pnpm lint`.
  - Then run the export's dry run: read `scripts/public-repo/export.mjs` and `sync.mjs` for the dry-run flag, and **never pass `--push`**.
  - Confirm three things:
    - The verify step passes with no UNCLASSIFIED paths.
    - The exported tree has `lib/speedrun/snapshot.json` equal to the stand-in.
    - It has no `public/speedrun/companies/` directory.
  - List, in the report and without fixing them, any other exported files that still quote real role titles or company names from the real snapshot (test fixtures, e2e). They are a follow-up decision for Aaron.
- [ ] **Step 5: Commit** the new and changed files by name:
  "Speedrun page: the public mirror ships a made-up stand-in snapshot and placeholder marks, never theirs".
