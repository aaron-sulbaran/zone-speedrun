# Splits: the phone-look round (Implementation Plan)

**Spec:** `docs/superpowers/specs/2026-11-10-splits-phone-look-round-design.md`, Rulings 18 to 21. Read it first.
**Branch:** `feat/splits-phone-round`, stacked on `feat/splits` (PR 4). Work in the worktree `.claude/worktrees/phone-round`, never in the main zone checkout: its `.next` serves Aaron's phone link on port 3295.

## Global Constraints

The Splits plan's Global Constraints bind this round in full: `docs/superpowers/plans/2026-11-09-speedrun-splits-clickable.md`, section "Global Constraints" (copy, styling, motion, components, z scale, git, checks, e2e, test pins). Read that section before you start. What this round adds or changes:

- **The e2e command** in this worktree, after `lsof -iTCP:3292 -sTCP:LISTEN` shows the port free:

  ```bash
  scripts/pwslot.sh "$PWD" <scratchpad>/e2e-<task>.log env CI=1 E2E_PORT=3292 pnpm test:e2e e2e
  ```

  Run e2e in the **foreground** with a long timeout (a whole run takes about 8 minutes), never in the background.
- **Off-limits ports:** 3220, 3221, 3276, 3277, 3290 and 3295. Never stop them.
- **New copy:** the only new string is the spotlight caption, "Some of my friends have sent 400.", in `lib/content/speedrun.ts`.
- **New motion values:** every one is a `Motion` key in `lib/speedrun/motion.ts`, reachable from `?tune` (`lib/speedrun/tuning.ts`, `tuningPresets.ts`; keep `tuningPresets.test.ts` green).
- **The full suite** must stay green: 109 passed and 2 skipped at the base `bdfd38e`, plus the new pins.

## Review Focus

1. **Hero fit:** the hero must still fit at 1440 by 900, 1440 by 790 and 1366 by 768 (the existing pins). The spotlight layer is fixed, and must never change layout.
2. **Skip:** any input during the spotlight leaves no veil, caption, clone or running animation, in the same tick that the intro reports "done".
3. **Chart labels:** they hold in all four chart layouts, including the Board's full chart, not only the hero's.
4. **The phone footer:** it isn't sticky below md, and it is unchanged from md up.

---

### Task 1: The join footer sits in flow on phones (Ruling 18)

**Files:** `components/speedrun/act2/JoinCard.tsx`, and the card-choice step(s) it renders (`PeoplePicker.tsx`, and any other card step that doesn't auto-advance); e2e in `e2e/speedrun.spec.ts`, or the spec that already covers the join card (find `data-join-footer`).

**Behavior:**
- Below md, `[data-join-footer]` is in normal flow at the end of the card: no `sticky`, no translucent fill or backdrop blur bleeding over content. From md up, it's unchanged.
- Picking a card choice (the sample people on "Help founders match you faster.") scrolls the footer's primary button fully into view, if it isn't already. Smooth, or `behavior: "auto"` under reduced motion. Below md only.
- Enter, Back, Continue and Build my network all behave as before.

- [ ] **Step 1: Write the failing e2e pins,** each with its regression comment:
  - **At 375 on the people step:** the footer's computed `position` is not `sticky`, and its top is at or below the last card's bottom.
  - **At 375:** clicking the first sample person ends with the primary button's rect fully inside the viewport. Use a bounded wait, then read in one `page.evaluate`.
  - **At 1440:** the footer's computed `position` is still `sticky`.
- [ ] **Step 2: Run them to see them fail** (slot script, foreground).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks, the build and the whole e2e suite** (slot script, foreground). Everything should pass.
- [ ] **Step 5: Commit.** Message: "Speedrun page: the join footer sits at the end of the card on phones, and a pick scrolls to it".

---

### Task 2: Flow chart labels never touch nodes, each other, or links (Ruling 19)

**Files:** `components/speedrun/FlowChart.tsx`, `lib/speedrun/flowLayout.ts` (if node spacing changes), plus their unit tests; e2e in `e2e/speedrun.spec.ts`.

**What I measured at the base** (a geometry probe on the PR 4 production build: label `getBBox()` against node rects, and `isPointInStroke` samples inside each label box):
- **Hero wide (1440):**
  - labels on node bars: Rejected 14, No reply 44, Still open 11, Rejected 2, Still open 1, Rejected 2, Still open 2, Rejected 4, Still open 2;
  - links through labels: Applied 84, Rejected 14, No reply 44, Rejected 2 (twice), Rejected 4, Still open 2.
- **Hero narrow (375):**
  - labels on node bars: Rejected 14, No reply 44, Still open 11, Rejected 2, Still open 1, Offer 2;
  - colliding labels: Rejected 2 and Still open 1;
  - links through labels: 6.
- **The cause:** each label sits 7 px above its node bar (`y={node.y - 7}`), while stacked nodes are only `gap` apart (9 in the narrow hero, 14 in the wide), so a label runs into the bar above it. Nodes are also painted in order, so a later bar covers an earlier node's label.

**Behavior,** in all four layouts (heroWide, heroNarrow, wide, tall):
1. No label's box (grown by 2 px) intersects any node rect.
2. No two label boxes intersect.
3. Links never draw over label text: every label has an opaque backing in the chart's `halo` colour, painted above the links layer. An SVG filter flood (`feFlood` plus `feMerge` with SourceGraphic, `flood-color` from the token via CSS) needs no measuring and works server-side. A measured rect is acceptable if you prefer it, as long as server HTML still renders labels.
4. All labels paint after all node bars, so no bar can cover a label.
5. The Applied value keeps `data-flow-source-value`, and the 84's flight still lands on it: the existing landing pins stay green.
6. The compact narrow hero may still drop the last two columns' exit labels, as today. Every label it does draw obeys 1 to 4.

- [ ] **Step 1: Write the failing pins.**
  - **e2e:** a probe like the one above, run on the hero at 1440 by 900 and at 375 by 812 after `settleHero`, and on the Board's full chart at 1440 and 390. It asserts zero node overlaps, zero label overlaps, that every label carries the backing, and that the backing's computed colour equals the halo token.
  - **Unit:** if `flowLayout` changes, a unit test pins the new spacing rule.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Keep `FlowChart.tsx` under about 200 lines; move the label placement into a pure helper in `lib/speedrun/` if it grows.
- [ ] **Step 4: Run the checks, the build and the whole e2e suite.**
- [ ] **Step 5: Commit.** Message: "Speedrun page: flow chart labels clear the nodes and sit above the links".

---

### Task 3: The 84 spotlight (Rulings 20 and 21)

> **Superseded in part by Ruling 27** (see the spec). The cut-out, the CSS mask, the mask-centre pin and the 0.92 veil below describe the first build. What ships is a full veil at 0.95 with a lit body-level copy of "84 applications", and a caption that is gone before the flight (`introSpotlightCaptionOutMs`).

**Files:**
- `lib/speedrun/heroIntro.ts` and its test;
- `lib/speedrun/motion.ts` and `tuning.ts`, plus presets;
- `components/speedrun/act1/useHeroIntro.ts` and `SplitsHero.tsx`;
- a new `components/speedrun/act1/Spotlight.tsx` (or a module beside `useHeroIntro`), kept under about 200 lines;
- `app/globals.css` (the veil token, both themes);
- `lib/content/speedrun.ts` (the caption);
- e2e in `e2e/speedrun.spec.ts` and the `settleHero` helper in `e2e/speedrun-flow.ts`.

**The schedule.** These defaults are new `Motion` keys, all tunable:
- **The subtitle's words** come in one by one from `introSubtitleAtMs` (1100). The stagger `introSubtitleWordStaggerMs` is 35, and each word takes `introWordMs`. "84 applications" are words in it; keep the `[data-hero-count]` structure the flight reads.
- **The flash** starts when the last subtitle word has landed. `introSpotlightFlashMs` is 450: two pulses of "84 applications", opacity and scale only.
- **The veil** fades in over `introSpotlightDimMs` (300) to `introSpotlightVeilOpacity` (0.92). It holds for `introSpotlightHoldMs` (700). The caption fades in with the veil.
- **The flight** starts as the hold ends (it no longer sits at a fixed `introFlightAtMs`). The veil and the caption fade out over the flight's duration.
- **The links, paragraphs and close** keep their current offsets from the landing:
  - the links start at the landing;
  - the paragraphs at the landing plus 280;
  - the close at the landing plus 980.

  Express these as offsets, so tuning the beat moves everything after it. `pressableAtMs` and `introEndMs` follow from the cues.

**The spotlight layer:**
- It's a body-level element (Portal to `document.body`), with `aria-hidden="true"` and `pointer-events: none`, at a z above the site chrome (40) and below the flight clone.
- **The veil** covers the viewport in the new `--spotlight-veil` token, defined for light and dark in `globals.css`: near-black, never `#000`. It has a soft elliptical cut-out (a CSS mask with a radial gradient) centred on the rect of "84 applications", measured at the beat's start and padded. The words stay where they are, untouched, lit through the hole.
- Don't lift the words with z-index inside the hero: the hero's running Web Animations create stacking contexts that would trap them.
- **The caption** sits on the veil just under the hole, in a light token that reads on the veil in both themes.
- **The flight clone** sits above the veil.

**Rules:**
- Any input during the beat (the existing skip) removes the layer and cancels the flash, in the same tick.
- At "done", nothing of the layer remains in the DOM.
- Reduced motion never mounts the layer.
- Ruling 6 (the failsafe shows the words, then the intro is skipped) and the no-JS failsafe still hold. The intro is now longer than the failsafe's 3,500 ms, so make sure the failsafe never reveals or cuts the beat while JS is running.

- [ ] **Step 1: Write the failing tests.**
  - **Unit:** the schedule tests for the subtitle words, the flash, the veil and the hold, with the flight, links, paragraphs and close as offsets from the landing.
  - **e2e,** each with its regression comment. Seek or step the intro's animations, as the existing hold-back pin does:
    - mid-subtitle, an early subtitle word is visible and the last is not;
    - during the flash, the count's transform or opacity differs from rest;
    - during the hold, the veil's computed opacity is at least 0.85, its colour isn't `rgb(0, 0, 0)` in either theme, its mask centre is within 3 px of the count's rect centre, and the caption shows the content string;
    - a keydown during the hold leaves no spotlight layer and `data-intro="done"` in the same `page.evaluate`;
    - under reduced motion the layer never mounts (a bounded negative wait);
    - at "done", the layer is gone;
    - the existing hero fit, landing and hold-back pins stay green.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Update `settleHero` and any pin that hard-codes the old timings to read the schedule instead.
- [ ] **Step 4: Run the checks, the build and the whole e2e suite.**
- [ ] **Step 5: Commit.** Message: "Speedrun page: the 84 spotlight, with the subtitle word by word, a flash, a veil and the friends caption".

---

### Task 4: Safari focus fixes and a WebKit e2e project (from the lead's gate)

**Where this comes from:** the lead's baseline gate on `bdfd38e`, desktop WebKit at 1440: 103 passed, 6 failed, 2 skipped. The artifacts are in the lead's scratchpad (`zone4-gate/e2e-webkit.txt`). The cause: Safari doesn't focus a button when it's clicked, and WebKit on macOS moves Tab only between form fields, as real Safari does.

**Ruling 22.** The round fixes the Safari bugs and adds a WebKit project to e2e:
- Fix code that relies on a click focusing its target.
- Tab-driven pins press the key Safari users press.
- **Why:** these bugs are on the surface Aaron reviews, and the lead's gate needs a WebKit run it can repeat.
- **Cost if wrong:** about 8 more minutes per `E2E_ALL` run.

**Files:**
- `components/speedrun/act2/MatchCard.tsx` and the connect sheet;
- the Board paste component (`PasteEmail.tsx`);
- any other component the audit below turns up;
- `playwright.config.ts`;
- `e2e/speedrun-flow.ts` (a `tabKey` helper);
- `e2e/speedrun-matches.spec.ts`, `e2e/speedrun-board.spec.ts`, `e2e/speedrun.spec.ts`.

**Behavior:**
1. **The connect sheet** (Follow, Ask for a warm intro) moves focus into itself when it opens: its first control, or its heading with `tabIndex={-1}`. Escape inside it closes only the sheet, keeps `preventDefault` so the detail stays, and returns focus to the button that opened it. Today, `MatchCard.tsx:44` handles Escape on the card's `onKeyDown`. In Safari, focus stays outside the card after the click, so the Escape never arrives (`speedrun-matches.spec.ts:122` and `:419` fail in WebKit).
2. **The Board paste:** after a click on the paste button, focus is on that button in every browser. Focus it from code on submit, as the match-row fix did, so the box never keeps focus and never holds a phone keyboard open (`speedrun-board.spec.ts:43` fails in WebKit).
3. **Audit** `components/speedrun/` for any other code that relies on a click focusing its target: focusout closers (`AccountMenu`), keydown handlers on a container that a click was meant to focus, and `toBeFocused` after a click in e2e. Fix each real Safari bug, and list in your report what you checked.
4. **A `webkit` project** in `playwright.config.ts`:
   - Desktop Safari, 1440 by 900, `deviceScaleFactor` 1, the same `baseURL`;
   - included only when `E2E_ALL=1`, so the default run stays Chromium.
5. **A `tabKey` helper** in `e2e/speedrun-flow.ts`: `"Alt+Tab"` under WebKit, `"Tab"` otherwise. Every Tab-driven pin uses it (`speedrun.spec.ts:333`, `:680` and `:779`, and any other). `:779` must still prove that the keydown finishes the intro: in WebKit it already reaches "done", and only the focus move failed.
6. **AGENTS.md Layer 2:** one gotcha line, saying e2e is Chromium unless `E2E_ALL=1`, which adds desktop WebKit, and that Tab pins use `tabKey`. Commit it on its own as `docs(agents): ...`.

- [ ] **Step 1: Write the failing pins.**
  - The connect sheet: focus is inside the sheet when it opens, and Escape closes it in WebKit (the existing `:122` and `:419` under `E2E_ALL=1`).
  - The paste button holds focus after a click in WebKit.
  - Run the WebKit project on those files to see them fail.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run the checks and the build.** Then run the whole suite twice:
  - the default (Chromium);
  - `E2E_ALL=1` (Chromium and WebKit).

  Both must be green. Any WebKit-only skip carries a comment naming the Safari behavior.
- [ ] **Step 4: Commit.** Message: "Speedrun page: Safari focus fixes for the connect sheet and the paste box, and a WebKit e2e project".
