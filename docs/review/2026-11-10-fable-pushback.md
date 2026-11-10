# Fable pushback on /speedrun (Splits), 2026-11-10

Reviewer: Claude Fable 5.2, independent of the build.

**What I read:** `AGENTS.md`, the 2026-11-09 Splits spec, the ledger's rulings and deferred minors (by heading, not every line), `lib/content/speedrun.ts`, and `git log main..HEAD` (14 commits).

**What I did not do:** run the page, open production, or read the components line by line. This was written against an 11 minute clock. Anything I inferred instead of checking is marked (unverified). I never saw the page render, so every claim about how it looks or feels is a claim about the copy and the spec.

## Verdict

1. The build is defended against the wrong risk. It is hardened against a 30 ms animation gap and landscape phones, and has no defense against a reviewer who never presses the button.
2. The hero tells them Aaron went 2 for 84 and never tells them what Splits does. The best one-line pitch in the repo sits in the meta description, where no person reads it.
3. The redesign turned a page a skimmer could scroll into an app a skimmer has to operate. That raises the price of seeing the best work, and nobody tested the trade with a reader.
4. 88 e2e tests, 0 readers. One outsider reading it cold for 60 seconds is worth more than fix rounds 3, 4 and 5 together.
5. Ship tonight. Production serving the old page while the new one collects rulings is the largest risk to the application, and Wednesday makes it worse.

## Top pushbacks, ranked by impact on getting the job

### 1. The 60 second reader never reaches the product

Count what a reviewer has to do before seeing one match:
- wait out or skip a 3 second intro;
- read a hero about Aaron's search;
- press "See where speedrun could go";
- watch the style switch;
- answer the join questions, or notice the secondary link "Skip the questions: see Sam's board" (`lib/content/speedrun.ts:56`);
- watch the build log.

The matches, the founder route, the board and the brief are the proof that Aaron can do the job. All of it sits four to six interactions deep. The old page could be skimmed by scrolling, which costs a reviewer nothing. The spec's goal "the page after onboarding never scrolls" is a layout property. No goal in the spec says "a reviewer knows what Splits is within N seconds".

**What I would do:**
- Put one sentence in the hero that says what Splits is. The meta description already has it: "What joining the speedrun talent network could give you on day one" (`speedrun.ts:11`).
- Make the skip path a first-class button on the join card, not a secondary link.
- Give the application a link that lands on the matches. None exists today: the only URL parameter the page reads is the dev-only `?tune` (`components/speedrun/SpeedrunExperience.tsx:24`). So every reviewer starts at the hero, every time, including the second visit.

The same problem hides the best material for a product reader. "what I decided, and why." and "What I'd measure" (`speedrun.ts:436-471`) are the strongest product thinking in the build, and they live in the fourth tab of four, behind everything above. A hiring manager wants that page first. Link it from the hero or the join card.

### 2. The most-read 50 words on the page are an unedited draft

The spec marks both hero paragraphs "a draft from Aaron's words for him to edit". The strings in `speedrun.ts:25-26` match the spec's drafts word for word. So the orchestrator's draft is shipping as Aaron's voice.

They are also the weakest writing on the page:
- "I've been grinding for internships for a long time" and "my friends are suffering too" claim empathy and show nothing specific.
- "Building that with you sounds like a lot of fun" is soft where it should say what he would build first.
- "That's why I built Splits." points at nothing. The two paragraphs before it never state the problem Splits solves, so "why" has no referent.

This is ten minutes of Aaron's own time, and no agent can do it for him. It outranks every open fix round.

### 3. The process is now the schedule risk

Still ahead: Task 5 fix round 3, a whole-branch review, a browser check, a PR, the lead orchestrator's gate at 390 and 1440, Aaron's merge, the production build, and a check through the site's rewrite. Aaron leaves Wednesday.

The ledger shows what the rounds are buying: a 21 to 34 ms hand-off gap (Ruling 8), arrow keys on the "Next: Board" button, a missing "Catches" comment on a test pin. No reviewer at speedrun will see any of them. Every extra round is a round the application spends pointing at the old page.

**What I would do:** freeze scope now, set a merge time tonight, and treat everything not visible to a reader in the first two minutes as a follow-up.

### 4. The rigor is pointed at the wrong browser and the wrong failure

- e2e runs on Chromium only: `playwright.config` has one project, `chromium`. The people reading this carry iPhones. The fixed dock with safe-area padding, `100dvh` sizing, `inert`, `overscroll-behavior` and the FLIP flight are all places where Safari differs. About 1,000 unit tests and 88 e2e tests do not include one WebKit run.
- Nobody outside the build has read the page. Every "confirmed" in the ledger is the controller looking at its own work.

Five minutes on a real iPhone in Safari, and one friend reading cold while Aaron watches silently, beat another Opus re-review.

### 5. "Turns on soon" reads as unfinished

`speedrun.ts:94`: "Live reading of your own resume turns on soon." `speedrun.ts:106`: "Reading your own resume is off right now."

A product engineer's application that says its headline feature is off invites the question "so what works?". The limits, the allowlist, BotID and the store were all built for features that ship dark, so that work earns nothing with this reader.

Pick one before merging:
- turn reading on behind a tight cap (a stage-change ask, and BotID through the rewrite is still unverified, so probably not by Wednesday);
- or remove every "soon" and "off right now", and present the sample people as the design.

### 6. Two lines read as presumptuous

- **"See where speedrun could go"** tells a team he has never met where their product should go.
- **"How my product would look"** claims ownership of a product that is built from their data, their logo and their look.

Offer, do not prescribe. "See what I would build first" or "Try the concept" says the same thing as a contribution. The "y'all" is fine, it is his voice and he is in Texas. Twice inside five seconds (the subtitle, then "okay. y'all's style.") makes it a bit.

"sux" is safe only if the reader hears the echo of jobhuntingsux.com, which the brief copy lists among "speedrun tools" (`speedrun.ts:325`). If that site is theirs, the headline is a callback and it is the smartest thing in the hero. If a reader misses it, it is a college student writing "sux" to a16z. Nobody checked which reading wins.

### 7. Product gaps a talent-team person will see in a minute

- **It is one-sided.** Splits is a candidate product. The people reading it run the other side: founders who need hires, and a small team triaging intros. "The talent team would see your profile and this match, and reach out to the founder if it fits" (`speedrun.ts:181`) makes them a manual step in every intro request. What does their queue look like, and what stops intro spam? There is no view of their side. The Why tab answers with one card, "Intros stay human", and its "What I'd measure" list has no founder-side number (time to fill, founder reply rate).
- **The inbox ask is waved through.** "In production this reads your inbox and calendar, read-only" (`speedrun.ts:129`). Reading Gmail means Google's restricted scopes, a security assessment and a serious trust ask, for a venture firm's talent network. A product person will ask why speedrun should carry that, and what speedrun gets. The honest answer is strong (knowing where a candidate stands elsewhere tells the team when an intro matters), and the page does not state it. The Why card "Your inbox is read-only" covers the candidate's trust, not speedrun's cost or gain.
- **The best speedrun-specific idea is buried.** The founder route ("you should think about building", `speedrun.ts:188`) turns the talent network into the top of the accelerator's funnel. It appears only as a conditional row and as the sixth card of the last tab. It belongs in the pitch.
- **Nobody has graded the matches.** A talent person will open one sample person and ask "would I make this intro?". Five minutes of Aaron checking the top three matches per sample person is worth more than the scroll-offset fix.

### 8. The 84 is exact and also "nudged"

The subtitle says "I sent 84 applications this fall". The note under the chart says "Numbers nudged for privacy" (`speedrun.ts:27`). An exact first-person number that the next line admits is altered is a small credibility leak in the first screen. Say "about 80", or drop "nudged" and keep only "No company names".

### 9. "Splits" is a speedrunning word with the idea taken out

The spec says "no deeper speedrun-gaming theme". Any reader gets the pun at once, then finds nothing behind it. The mapping is sitting right there and it is a product idea: splits are the times between stages, and the board built from an inbox could show them (applied to first reply, reply to interview). One line would earn the name. Zero lines makes the name a default.

### 10. Three cheap things outside the page

- **The Slack unfurl.** The share card is the site's generic one (`AGENTS.md`, Gotchas). This link spreads inside the team by someone pasting it in Slack. Reader two's first impression is a card that does not say Splits.
- **No way to know it was read.** No analytics. Aaron will not know if anyone opened it or where they stopped, so he cannot time a follow-up.
- **The close is in the wrong place and asks for nothing.** "Built by Aaron Sulbaran" (`speedrun.ts:473-482`) ends the Why tab, the last of four. Its links are My site, MVP and LinkedIn. There is no "let's talk" and no email, so the reviewer leaves with a product and no next step.
- **"Built in a weekend" needs a check.** The plans in this repo run from 2026-11-07 (a Saturday) to 2026-11-10. If the shipped page took four days, say four days. It is still fast, and it is true.

### 11. The spec measured pixels and inferred a reader

The spec's "Why" is four pixel measurements. The redesign's whole premise is Aaron's line "more clickable instead of scroll driven", taken as a requirement. It was never tested against the one reader who matters. The build's agent process (Sonnet builders, Opus reviewers, a rulings ledger) is itself a selling point for an AI-forward team, and the page never mentions it. Rigor the reader cannot see is cost with no return: either surface it in the Why tab or stop paying for it.

## Cut or defer

**Cut now:**
- fix rounds 4 and 5 on Task 5, unless a finding is visible to a first-time reader;
- every deferred minor in the ledger;
- the landscape-phone and no-`checkVisibility` work as merge blockers;
- the "soon" copy.

**Do first, in this order:**
1. Aaron rewrites the two hero paragraphs and adds one sentence saying what Splits is.
2. Soften the button and "my product".
3. One real iPhone Safari pass, start to finish.
4. One cold reader, 60 seconds, Aaron silent. Fix only what that person trips on.
5. Merge tonight.

**Defer until after it ships:** the `/speedrun` share card, a read signal, the splits line, the talent team's side of the product.

## Open questions for Aaron

1. Is the application already submitted? If yes, reviewers may be on the old page right now, and merging beats polishing. If no, what date does it go in?
2. Who outside this build has read the new page? If nobody, why not before round 3?
3. Is jobhuntingsux.com speedrun's own? If yes, should the hero say so in a word?
4. No link can land a reviewer directly on the matches. Is a `?demo=sam` style entry worth one small change before the merge, so the application can point at the product itself?
5. Did you mean to ship the paragraph drafts as written?
6. What does the talent team get from Splits that they do not have today? Where does the page say it?
7. Where does the page ask for the conversation, and tell them how to reach you?
8. Do you want reading switched on for the reviewers, or the "soon" lines gone?
