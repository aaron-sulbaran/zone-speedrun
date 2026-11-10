# /speedrun as Splits: a one-screen hero and an app shell (design)

Aaron's direction, 2026-11-09: "I want it to be more clickable instead of scroll driven, I want it to be a true onboarding experience ... main screen, intro me, click, move towards their version and boom it's a real product with a real clickable onboarding flow."

He settled these in chat:
- **The hero.** "job hunting sux." fades in word by word, then "I would know." The 84 applications fly into the flow chart.
- **The paragraphs.** Two short paragraphs replace the three long ones.
- **The closing block.**
  - Line: "That's why I built Splits."
  - Subtitle: "How my product would look, built in y'all's style."
  - Button: "See where speedrun could go."
- **The name.** The product is called **Splits**, with no deeper speedrun-gaming theme.
- **After onboarding.** The network screen becomes an **app shell**: a match list with a detail pane, plus a tab bar.

Decisions he didn't state are marked **(my call)**.

## 1. Why

Measured on the current build (3277, head 2fa97819):
- **The hero at 1440 by 900** is a text column on the left half of the screen. The right half is empty, and the chart starts below the fold.
- **On a 390 phone** the three paragraphs fill the first screen.
- **The join and building phases** already fit one screen at both sizes, so they stay.
- **The network phase** is 3,407 px tall on a 390 phone, about four screens of stacked match cards. That's the other half of "too scroll based".

## 2. Goals, non-goals, anti-goals

**Goals**
- The hero is one screen at 1440 by 900 and at 1280 by 800, with no page scroll. On a phone, its button is always on screen.
- The page after onboarding never scrolls. Only panels inside the shell scroll.
- Every word of the hero is in the server HTML. Motion only enhances it.

**Non-goals**
- Changing the join questions, the building log, matching, the board's logic, the brief or the egg.
- Turning on reading or email.

**Anti-goals**
- An intro that holds the visitor. The hero's motion ends in about 3 seconds, and any input jumps to its end state.
- A second, separate mobile layout. One component tree, with responsive classes, as the rest of the site does.
- Deep speedrun-gaming puns.

## 3. The hero

### Layout
**Desktop, from lg.** Two columns, vertically centered in the viewport under the site chrome (the logo and the Menu pill):
- **Left column:**
  - the kicker;
  - the headline, "job hunting sux.";
  - the second line, "I would know.", in the muted tone;
  - the subtitle with the 84;
  - two short paragraphs.
- **Right column:** the flow chart alone, with a one-line privacy note under it.
- **Closing block:** centered under both columns. It holds the line, the subtitle and a large pill button.

**Phone, below lg.** One stack, in this order:
- the kicker;
- the headline and "I would know.";
- the subtitle;
- the chart, directly under the 84;
- the two paragraphs.

The closing block **docks to the bottom of the viewport** (fixed, full width, safe-area padding), like an app's primary action. Content that doesn't fit scrolls under it. The dock clears the pinned affiliation pill, because that pill only shows in act 2.

### Copy
All copy lives in `lib/content/speedrun.ts`.

- **Kicker:** "For the a16z speedrun talent team". Unchanged.
- **Headline:** "job hunting sux." Unchanged.
- **Second line:** "I would know." Replaces "I've been in the loop."
- **Subtitle:** "As an ECE student at UT Austin, I sent **84 applications** this fall."
  - The number comes from `AARON_ENTRIES.length`, so the sentence and the chart can't disagree.
- **Paragraph 1, a draft from Aaron's words for him to edit:** "I've been grinding for internships for a long time. Every recruiting season I know I'm not the only one suffering, because my friends are too."
- **Paragraph 2, a draft from Aaron's words for him to edit:** "I believe in what speedrun is doing: actually helping people land these jobs, not just listing them. Building that with you sounds like a lot of fun."
- **Privacy note under the chart:** "Numbers nudged for privacy. No company names."
- **Closing block:**
  - line, "That's why I built Splits.";
  - subtitle, "How my product would look, built in y'all's style.";
  - button, "See where speedrun could go".

Removed from the hero:
- paragraph 3;
- the funnel card (its kicker, stat tiles, sample rows and long caption);
- the turn lines ("I'm not building this for me.").

The switch's line, "okay. y'all's style.", stays.

### The chart
- **A new `hero` size of `FlowChart`.** It draws one horizontal layout at every width, so the hero has no vertical variant.
  - **Desktop:** about 560 by 340.
  - **Phone:** the full column width by about 190.
- **No lane column.** It starts from a single "Applied" node of 84, using `aaronFlow({ lanes: false })` (my call). Lanes made the hero chart busy, and the board's chart keeps them.
- **The data is unchanged:** 84, 15, 12, 8, 2. The subtitle makes no claim about outcomes, so it agrees with the 2 open offers.
- **The accessible title and table** stay as `FlowChart` renders them today.

### Motion

The default timings below come from `MOTION`, and the `?tune` panel can override them so Aaron can tune them by hand.

| Time | What happens |
|---|---|
| 0 ms | "job", "hunting", "sux." enter one word at a time: 120 ms apart, 420 ms each, opacity plus 8 px rise, `SR_EASE`. |
| 700 ms | "I would know." enters. |
| 1,100 ms | The subtitle enters. |
| 1,500 ms | **The flight.** A clone of the subtitle's "84" moves (FLIP, transform only) to the chart's Applied label, scaling up as it goes. When it lands, the chart's own label shows and the clone is removed. Then the chart's links reveal left to right over 1,100 ms, through a clip on the links group. On a phone the flight goes straight down. |
| 2,300 ms | The paragraphs enter, 150 ms apart. |
| 3,000 ms | The closing block enters last, and the button can be pressed from this moment. |

Rules:
- **Skip.** Any `pointerdown`, `keydown`, `wheel` or `touchmove` during the intro calls `finish()` on every running animation. The page then shows the end state in the same frame.
- **The button is always in the layout** (its space is reserved). Before 3,000 ms it is transparent, and a press counts as a skip.
- **Reduced motion:** the end state renders immediately, with no flight.
- **When it plays.** The intro plays on each page load and on "Replay from the top".
- **No layout shift.** Every element holds its final box from the first paint, and only opacity and transform animate.

### The button
- **What it does:** it plays the existing switch (the cover, "okay. y'all's style.", the reveal) into the join phase.
- **What moves:** `Switch` stops rendering the turn lines and its own button. It keeps the strip, and exposes `play` to the hero through the existing `playSignal`, or a ref (the implementer's choice).
- **Styling:** a large pill (at least 56 px tall, about 20 px label) in the site accent.

## 4. Join and building

- **Join, desktop:** the lede paragraph under "you joined. now what?" goes. The headline, the three stats and the skip button stay.
- **Splits appears in two places (my call).**
  - **The hero eyebrow:** "Splits · a concept" (it was "Talent network · a concept").
  - **The join card header label:** "Splits · Join" (it was "Talent network · Join").
- **Building:** unchanged.

## 5. The network phase as an app shell

### The frame
- **Height.** The shell fills the viewport under the site chrome (`100dvh` minus the chrome's height), and the page doesn't scroll.
  - Panels scroll inside with `overscroll-behavior: contain`.
  - If the viewport is shorter than 560 px (a phone in landscape), the shell falls back to normal page flow and the page scrolls.
- **The top bar holds:**
  - the speedrun logo and a "Splits" wordmark;
  - a "Concept · not affiliated" badge, visible at every width;
  - an account button showing the visitor's initial. It opens a small menu with:
    - the visitor's name;
    - "Start over";
    - "Replay from the top";
    - the full affiliation line.
- **Tabs.**
  - **Labels:** Matches, Board, Brief and **Why**. Why replaces "Decisions", and its content stays the same.
  - **On desktop,** the tabs sit in the top bar.
  - **On a phone,** they form a bottom tab bar with Lucide icons and labels. It sits above the safe area, and is the same `role="tablist"` with the same keyboard model as today.
- **The pinned affiliation pill is hidden** in the network phase, because the badge and the menu carry the line.

### Matches: list and detail
- **The list.** Each row shows:
  - the company mark;
  - the company and role;
  - one line of reason (the first reason the matcher gives);
  - a chevron.

  When the result has founder routes, a "Founder route" row comes first.
- **The detail:** the current `MatchCard` content in full, or the `FounderRoute` content.
- **Desktop:**
  - **Layout:** the list on the left (about 380 px) and the detail on the right. Each scrolls on its own.
  - **Starting selection:** the first row.
  - **Keys:** Up and Down move the selection, and focus stays in the list.
  - **The selected row:** `aria-current="true"`.
- **Phone:**
  - **Opening a row:** the list fills the panel, and tapping a row slides the detail in from the right (`STEP_EASE`, 360 ms), covering the list. Focus moves to the detail's heading.
  - **Closing it:** Back or Escape slides the detail out, and focus returns to the row.
  - **No history entries are pushed** (my call). The browser's Back would fight the phase machine.
- **The list header:** "{name}'s matches" with a count line, for example "6 worth your time first". This heading becomes the phase heading that `usePhaseChange` focuses.

### Board, Brief, Why
- **Board and Brief** fill the main area as they render today, inside a scrolling panel.
- **Why** holds:
  - the product decisions;
  - then the close, as a dark card rather than a full-bleed footer band.
- **The "Next: ..." buttons** stay at the end of each panel.
- **The network header** ("You're in the network, Sam." plus the next line, the tag and the resets) is removed. The list header and the account menu replace it.
- **The egg** still works on every tab.

## 6. Accessibility and quality bars
- Every interactive element is reachable by keyboard, with visible focus.
- The tab bar keeps the roving tabindex.
- The intro and the detail slide respect reduced motion.
- **Fit:** no horizontal scroll at 375, 390, 768, 1280 or 1440.
- **The hero fits on one screen** at 1440 by 900 and 1280 by 800. The button's bottom edge is inside the viewport, and the document's scroll height equals the viewport height.
- **On 390 by 844 and 375 by 667,** the docked button is fully visible on load.
- **The shell never scrolls the document.** At 1440 by 900 and 390 by 844 in the network phase, the scroll height equals the viewport height.
- Components stay under about 200 lines. New logic (intro timeline, selection model) goes in pure, tested modules under `lib/speedrun/`.

## 7. Testing
- **vitest:**
  - the intro timeline module (order, totals, skip);
  - the selection model (first-row default, Up and Down at the ends, founder row first);
  - `aaronFlow({ lanes: false })` (one source node of 84);
  - the copy invariant (the subtitle's number equals `AARON_ENTRIES.length`).
- **e2e:** rewrite the specs that assert the old opener, the turn, the network header and the stacked matches.
  - **Each pin names the regression it catches**, and the line that would go red if the guard were removed (memory: e2e pins must be able to fail).
  - **Each fit bar in section 6 becomes a pin.**
  - **The skip pin reads state in the same tick as a `pointerdown`.** A pin that waits past 3 s would pass with the skip removed.
- **Runs:** at most two Playwright runs at once, through the slot script.
- **Visual check:** in a browser at 390 and 1440 before reporting. Motion timing is checked in headless Playwright or by Aaron's eye with `?tune`, never in the hidden pane.

## 8. Assumptions (my calls)
1. The hero chart drops the lane column.
2. Splits shows in the join eyebrow, the join card label and the shell's top bar, and nowhere deeper.
3. No browser history entries for the phone's match detail.
4. "Why" replaces "Decisions" as the tab label.
5. The close moves inside the Why panel.
6. The intro replays on "Replay from the top".
7. The meta title becomes "Splits: a concept for the speedrun talent team · Aaron Sulbaran".

## 9. Open for Aaron
- The two paragraph drafts in section 3 are built from his dictation. He edits them, and I only fix mechanics.

## 10. Rollback
Revert the branch's commits for this work. Nothing touches the server routes or the env. (Since 2026-11-09 /speedrun lives in its own repo, `zone-speedrun`, so there are no public export rules to keep in step.)
