# /speedrun: a phased onboarding (design)

Revises `2026-11-07-speedrun-design.md`. Where the two disagree on how the page is laid out or how a visitor moves through it, this one wins. Everything else in the earlier spec stands: the system (snapshot, reader, ranking, inbox, brief, guards), the sample people, the copy rules, the route-scoped theme and the rollback.

Aaron asked for this build without further questions (2026-11-08). Every decision he did not state is marked **(my call)** and collected in section 9; his open questions for later are in section 10.

## 1. Why

Aaron's direction, in substance: make it an onboarding, not a scroll. A visitor types their name, then what they're looking for, and the pre-made samples live inside that flow. Every button on the page opens a new phase in place; nothing pushes the visitor down to a section they then scroll back up from. Phases, not pages. The switch from his style into theirs is the motion showcase, the reason the page changes style at all. Matches and the rest come after the onboarding. Because it's an MVP, there is a way to reset the onboarding and see it from the start.

## 2. Goals, non-goals, anti-goals

Goals
- One phase on screen at a time: Aaron's opener, the join, the build, your network. A button moves you forward; nothing scrolls you there.
- The join feels like speedrun's own: their card, their rhythm (one question per screen, tap to advance, Enter to continue, a 01 / 0N counter, Start over), their step motion.
- The concept does what their real join doesn't: it uses your name and answers on the spot and shows you matches now, not in a week or two.
- The switch into their style is worth watching, and its timings can be tuned by hand.
- A visitor with 30 seconds can skip the questions and still land on a full board.

Non-goals
- New routes, a URL per phase, or persistence across reloads (a reload starts at the opener).
- Any change to the system: ranking, extraction, classifier, brief composer, guards and live switches stay as they are, except the two optional intake fields in section 5.
- Re-capturing their palette or type (done on 2026-11-06).

Anti-goals
- Scroll hijack. Phases change on a button, a tap or Enter, never on a wheel or swipe; inside a phase the page scrolls normally.
- Anything that sends the visitor's name anywhere. It stays in the browser.
- An onboarding that asks questions it then ignores: every answer changes the build, the matches or the copy.
- A page that could pass for an official speedrun page: the not-affiliated line stays on every speedrun-styled phase.

## 3. What the research found (2026-11-08)

Two agents walked speedrun's real flows (talent network join, the founder application and alpha, the tools), offline and without submitting. The synthesis lives in the session scratchpad; what matters here:
- **Their join** is a card on their home hero: header with logo, "TALENT NETWORK · SIGNUP", "01 / 06" and "START OVER"; an 8px prism-gradient progress fill at (step + 1) / total, width .48s cubic-bezier(.16,1,.3,1); a purple "01 →" eyebrow; one required question per screen (email, LinkedIn, full name, founding?, student?, newsletter; students add graduation date and working arrangements); a prism CTA and "PRESS ENTER ↵". Tapping a Yes/No pill selects at once and advances after 260ms. Continue is disabled until the answer is valid.
- **Their step motion**: the old step disappears (no exit animation); the new one enters over .36s cubic-bezier(.22,.61,.36,1) from translateY(14px) and opacity 0, or from -14px going back. No scale, blur or stagger. Their welcome-to-form handoff: exit .24s ease to translateY(-14px) and opacity 0, then the form enters .32s cubic-bezier(.4,0,.2,1) from 14px. Lists cascade with sr-cascade-in .42s cubic-bezier(.16,1,.3,1) from translateY(10px) scale(.99).
- **Their completion**: a "Submitting" stage, then "You're In The Network." with "✓ Signup Complete" and a promise that a partner reads it this week; founding = yes adds "You Mentioned Founding." pointing to alpha and speedrun. Only after joining do they ask for a résumé ("Help Founders Match You Faster"). Alpha leads with the résumé instead ("we read it, you just confirm").
- **No personalization**: their join never uses your name or answers. That gap is the concept's pitch.
- **Founder application chips** select with a background-position sweep (.32s cubic-bezier(.2,.7,.3,1)), the text color swapping .14s after a .1s delay, and a .25s scale pulse.

## 4. The experience

Four phases on `/speedrun`, one on screen at a time. The site's logo and Menu pill stay at every phase.

### Phase 1: the opener (Aaron's style)
Unchanged content: the opener in his words, his fudged funnel, the turn line ("I'm not building this for me...") and the button. The button starts the switch. No Replay button lives here any more (it moves to phase 4).

### The switch (the motion showcase)
The approved sweep, landing on a phase instead of a scroll position: his sea-blue cover slides in from the right (480ms, his cover ease), the line "okay. y'all's style." holds, and under the cover the page swaps to phase 2 and sits at the top. The cover then slides off to the left (560ms, expo-out) trailing their purple, aqua and cream band. As it clears, phase 2 arrives in their motion: the hero's eyebrow, headline, lede and stat tiles cascade (sr-cascade-in, .42s, 60ms apart), and the join card enters last with their form entrance (.32s from 14px), its first input focused when it lands. **(my call: the sweep stays because Aaron approved it in the mockup; the arrival choreography is new.)** Reduced motion: a 240ms fade out and a 180ms fade in, no cascade. Every timing lives in one motion constants object and can be tuned in the dev panel (section 6).

### Phase 2: join (their style)
Their home hero layout. At `lg` and up: the hero on the left (eyebrow, headline, lede, stat tiles, as today) and the join card on the right. Below `lg`: a shortened hero (eyebrow and headline only) and the card under it, so the card's first question is on screen at 390 by 844. Under the stat tiles, a ghost button "Skip the questions: see Sam's board" for the 30-second visitor (it does what "Skip to the dashboard" does today).

The card, in their anatomy: a header row with the speedrun logo, a label ("Talent network · Join"), the counter ("01 / 07") and a "Start over" link; the 8px prism progress fill; the purple eyebrow ("01 →"); the question; the input; a footer with a ghost Back (disabled on step 1), Continue (disabled until the step is valid), "Press Enter ↵", a privacy line ("Your name stays in this browser. Nothing you type is saved."; ruling R18, since places and the one sentence do reach the match route) and the inline not-affiliated line.

The questions **(my call: wording and order; they mirror their join, swapping contact details for what a demo can use)**:
1. **What should we call you?** First name, text, required (1 to 40 characters). Helper: it stays in your browser and makes the board yours.
2. **What are you looking for?** The function chips (software engineering, AI engineering, product, design, data, operations, founding), multi-select, at least one.
3. **Are you a full-time student?** Yes / No pills; a tap advances after 260ms.
4. **What kind of work?** Students only. Multi-select lettered cards A to D (the letter becomes a check when picked): internships between semesters, part-time during the semester, a full-time job while in school, a full-time job after graduation. At least one. The counter total grows from 07 to 08 the moment someone answers yes to step 3, as theirs does.
5. **Where do you want to work?** The place chips plus a typed place, as today; optional (an empty answer means anywhere).
6. **Are you considering or in the process of founding?** Yes / No; a tap advances after 260ms.
7. **Anything founders should know?** One sentence, optional (today's "why").
8. **Help founders match you faster.** Today's résumé step: upload your own (live only when reading is on) or pick a sample person (Maya, Ravi, Sam, Lena, Dev), plus the Gmail and Calendar toggles. Continue reads "Build my network".

Step motion is theirs: no exit, the new step enters .36s cubic-bezier(.22,.61,.36,1) from 14px (forward) or -14px (back). Selecting a chip or card uses the founder-application sweep (section 3); pills fill black at once. Enter advances on text steps; on a chip step Enter advances when the step is valid. Focus lands on the step's first control after each change; an `aria-live` line announces "Step 3 of 8" and the question. "Start over" clears every answer, including the name, and returns to step 1 with no animation beyond the step entrance.

### Phase 3: building
Pressing Build my network turns the card into their "Submitting" stage for a beat ("Building your network, {name}."), then the page changes phase (their .24s exit up, then the phase enters) to the build log, full width, personalized ("made for {name}..."), skippable as today. When the log finishes (or is skipped), the page moves on to phase 4 by itself.

### Phase 4: your network
- A header in their completion voice: "You're in the network, {name}." with a "✓ Built for you" tag and one line on what happens next.
- Tabs as frosted pills: **Matches · Board · Brief · Decisions** (selected: black fill, white text). A tab change uses the step motion. Each tab ends with a "Next: ..." button to the following tab; Decisions ends with the close.
- Header controls, right-aligned: **Start over** (back to phase 2, step 1, everything cleared) and **Replay from the top** (back to phase 1, so the switch can play again).
- Matches: today's matches list. The founder card reads "You mentioned founding." when the visitor answered yes on step 6, or when the résumé reads founder-heavy as today.
- Board and Brief: today's components; the brief's in-page preview greets the visitor by name. The sent email (when on) stays the fixed template with no visitor text, as today.
- Decisions: today's product-decision cards. The close (built by Aaron, links, not-affiliated line) and the Easter egg sit below the tab content on every tab.

### Who the page addresses
The display name is the typed name, else the picked sample person's first name (the skip path), else "you". A visitor who types "Alex" and borrows Sam's résumé is addressed as Alex; the build log says it read Sam's sample résumé.

## 5. State and data

- **Phase model** (pure, `lib/speedrun/`): `opener | join | building | network`, with the tab inside network. Events: start (opener to join, after the cover), built, logDone, startOver, replayTop. Tested as a reducer.
- **Onboarding answers** gain `name`, `student`, `arrangements` and `founding`. The step list is derived from the answers (the student branch adds step 4). Validation is per step and pure.
- **Name** lives only in client state. It is never part of a request body: not the match route, not the read route, not the brief route. A test asserts the request bodies.
- **Intake** gains two optional fields, sent to the match and read routes and accepted by their zod schemas:
  - `seniority`: students who pick any full-time arrangement (while in school or after graduation) map to `new_grad`; students who pick only internships or part-time work map to `intern`; non-students send nothing and the résumé decides. Ranking uses `intake.seniority ?? profile.seniority`.
  - `founding`: true shows the founder routes whatever the résumé's founder score.
- **Phase changes** scroll the window to the top under the transition (instantly, never smooth), move focus to the new phase's heading, and never touch the URL. The browser's back button leaves the page, as on theirs.

## 6. Motion constants and the tuning panel

All switch and step timings (cover, hold, reveal, band width, cascade stagger and duration, card entrance, step slide distance and duration, choice advance delay, progress duration) live in one object in `lib/speedrun/motion.ts`. A dev-only panel (`?tune` on a development server; absent from production bundles) shows sliders for them, a "Replay the switch" button, two presets ("Approved sweep" first, then a faster "Snappy") and a "Copy values" button that copies flat JSON, the lab format Aaron likes. **(my call: a panel on the page instead of a separate lab branch, so he can tune it on the real flow.)**

## 7. Testing

- Unit (vitest): the phase reducer, the step list and its student branch, per-step validation, the seniority and founding mapping, ranking with the two new intake fields, request bodies without the name.
- e2e (Playwright, against a local production build, Chromium): the full path (switch, eight steps with the student branch, build, all four tabs, Start over, Replay from the top); the skip path; keyboard only; reduced motion; the existing board, brief, matches, upload and egg specs moved onto the phased entry. 390 by 844 and 1440 by 900 checked by eye.

## 8. Constraints carried over

Layer 1 as it stands (tokens only, copy in `lib/content/`, no em dashes, first person in Aaron's voice, components under about 200 lines, reduced motion respected). The route-scoped theme still needs Aaron's Layer 1 exception (A62); its wording follows this spec. Ruling R8 (Act 1 stacked above Act 2) is superseded by the phases. Agents never merge or deploy.

## 9. Calls I made (check these)

1. The pre-made introductions are the five sample people, offered at the résumé step and through the skip button. (Aaron's phrase; my reading.)
2. The questions, their order and wording (section 4), mirroring their join; name instead of email and LinkedIn.
3. The approved sweep stays as the switch, plus a new arrival cascade; a faster preset lives in the tuning panel.
4. Phase 4 uses tabs instead of a scroll of sections, each with a "Next" button.
5. Two resets: Start over (the onboarding) and Replay from the top (the whole page).
6. No persistence across reloads; no URL per phase.
7. Where-to-work and the one-sentence why are optional; everything else is required, as theirs.
8. The student answers set seniority; founding = yes forces the founder card.
9. The tuning panel ships on the page in development only.

## 10. Questions for Aaron, after the build

Collected in the PR and on the board when the build lands.
