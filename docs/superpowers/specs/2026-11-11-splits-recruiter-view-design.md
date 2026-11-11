# Splits: the talent team's side (design)

On 2026-11-11 Aaron and I brainstormed the other half of Splits: what it does for the speedrun talent team, not just the person job hunting. His words are quoted where they set the bar. Decisions he didn't state are marked **(my call)**. Rulings are numbered from 40, after PR 5's 32 to 34.

> "they're not job hunting, they're headhunting so maybe I should mockup the recruiter side of things and how this helps THEM alongside the actual job searcher."

> "the speedrun team gets a ton of inbound and they need help with the correct candidate parsing, matching them, making the intro, and if that entire loop is manual or not optimized then it can be a huge pain."

**Who owns what.**
- **PR 6, the Builder's product round,** owns the candidate side and the shell: picks and ranking on Matches, the one intro request, the Board with the candidate's shortlist, Today, Intros, the Brief, Why, and the desktop top bar.
- **This spec is PR 7.** It's built on PR 6 and owns the talent team's desk, the earned moment after a candidate spends their request, and what the Candidate / Talent team switch does.
- **The interface between them** is the intro request (Ruling 40).
- **Nothing here is built until PR 6 merges.**

## 1. Why

- **The demo serves one side.** Every screen after the hero is the candidate's. The people reading it are the talent team, and nothing shows them what Splits does for their week.
- **The fix is one loop with two sides.** A candidate spends one intro request on their top match, and that request is the unit of work on the team's desk. Scarcity is the signal: a recruiter skims past 500 applications, but a request someone spent their only pick on means something. Aaron's frame: "think stable marriage problem", and "think like a tinder or hinge super link".

Stage stays pilot. `SPEEDRUN_AI` and `SPEEDRUN_EMAIL` stay off. Everything on the team's side runs in the browser, sends nothing, stores nothing, and resets on Start over.

## 2. Goals, non-goals, anti-goals

**Goals**
- A reader from the talent team sees, in about a minute and about five clicks, how Splits carries one intro request from a candidate to a connect, and where it saves the team work.
- The page says at every step what is happening and whose view it is. Aaron: "clear communication of what is happening and what we're looking at".
- It shows how a complete version would work, not only how it looks. Aaron: "beyond how it'll look is more so how the flow is shown and how it would function if a complete version was built".
- The team's side is always one click away: "so they can always check out the talent team facing version".

**Non-goals**
- A second full MVP for the team. Aaron: interactive "but not as in depth as the actual user facing piece".
- The candidate side and the shell's layout, both PR 6's.
- Real sends, real founders, accounts, storage, or AI. Turning on reading or email.
- Claiming to know speedrun's internal tools. The page says so (Ruling 50).

**Anti-goals**
- Invented outcomes at real companies (Ruling 43).
- A new toggle for the founder step (Ruling 46).
- The brainstorm wireframes' look. Everything is built in speedrun's style with the `sr-*` tokens, as act 2 is today.

## 3. The loop, as a complete version would run it

This is the product the demo stands for. The demo walks one request through steps 4 to 9, and shows 10 to 12 on a finished sample (Ruling 48). Steps 1 to 3 are the candidate side: 1 and 2 are built, and 3 is PR 6.

| # | Who | What happens |
|---|---|---|
| 1 | Candidate | Joins: resume plus three questions. *(built)* |
| 2 | Splits | Parses the profile and ranks live roles. *(built)* |
| 3 | Candidate | Brings matches forward, ranks them, and spends the one intro request on the top pick. *(PR 6)* |
| 4 | Splits | Files the request on the desk with a fit brief: why they fit the role, why the role fits them, and everyone else who spent their pick on this role. |
| 5 | Talent team | **Gate.** Decides who reaches the founder, comparing everyone who picked the role. |
| 6 | Splits | Builds the one-pager, "a curated one pager of the candidates work, most relevant project or experience, their relevant links like linked, X, or portfolio", and sends it with "Are you interested in interviewing them?" |
| 7 | Founder | **Gate.** Replies: interested, or not now. |
| 8 | Splits | Interested: drafts the warm intro to both, with the team copied. Not now: frees the pick, and the candidate's next ranked match goes live. |
| 9 | Talent team | **Gate.** Sends the intro, editing it if they want. |
| 10 | Splits | Keeps tracking: first chat, interviews, offer, hire yes or no. One-tap check-ins at set times, and the existing inbox reading (`classify.ts`) picks up interviews and offers for candidates who connected Gmail. |
| 11 | Both sides | In the first months, a short survey: was it the match, or was it the people? It gives the team qualitative metrics, and it labels each outcome. |
| 12 | Splits | Learns. Each miss is a **fit miss** (the match didn't make sense) or a **people miss** (good match, wrong chemistry). Only fit misses change matching. Early on, Splits shows the team the patterns and the team adjusts; it doesn't retune itself yet. |

Also in the complete version, and said on the page rather than built (my calls):
- **Nothing waits forever.** A request nobody reviews in 3 days is flagged. A founder silent for 5 days frees the pick, as a not-now does.
- **The team gets its own morning brief,** composed the way `lib/speedrun/brief.ts` composes the candidate's: new top picks, founder replies, intros made, hires.
- **Spending a request is consent** for that one-pager to go to that company, and only that company.
- **Inbound stays searchable.** Splits parses everyone who joins; the desk lists only spent picks, so the queue stays short.
- **It could live inside their tools.** Aaron: "I don't know what their internal systems look like but that splits could be an internal tool as well".
- **A real version is a stage change.** It stores personal data and sends email, so it needs Aaron's stage-change ask first.

## 4. The interface with PR 6: the intro request

**Ruling 40. The intro request contract.**

**PR 6 creates it.** When a candidate spends their one request on their #1, PR 6 creates the request. The type lives in one pure module under `lib/speedrun/`; PR 6 creates the module, and PR 7 adds the desk's transitions to it. It holds:

| Field | What it is |
|---|---|
| `candidate` | First name, headline, `profile.shipped`, and whether it's the visitor or a sample person. |
| `match` | The `Match` the request is on: company, role, reasons, score. Only a match whose `connect` includes `"intro"` can carry it. |
| `ranked` | The candidate's brought-forward match keys in rank order, the request's match first. PR 6 owns the order. |
| `fit` | `whyThem`, from `match.reasons`; `whyRole`, from the intake (their why, places, targets). |
| `status` | `requested`, `withFounder`, `connected` or `passed`. |
| `introSent` | Whether the team has sent the drafted intro. Meaningful only while `connected`. |
| `passedBy` | `team` or `founder`, when `passed`. |

**Who changes what.**
- **The request is bound to its match,** by `matchKey`, not to a position in `ranked`. Reordering the shortlist never moves the request. An **eligible** match is one whose `connect` includes `"intro"`.
- **PR 6 owns** creating the request and swapping it (the candidate moves their request to another match). A swap is allowed only while `requested`. Opening the compare drawer doesn't change that; only a send or a pass does.
- **PR 7 owns** every transition after that:
  - `requested` → `withFounder` (the team sends the one-pager);
  - `withFounder` → `connected` (the founder says yes);
  - `introSent` (the team sends the intro);
  - any of those → `passed`.
- **When a request passes:** one shared pure function marks it `passed`, and makes the next eligible match in `ranked` the new live request, at `requested`. With none, the candidate has no live request. PR 6's shortlist shows the result, and the desk shows the new card.

**What the candidate sees.** The candidate's shortlist (PR 6) shows the live request's status, in the desk's own words: Requested, With founder, Connected.

**Only the visitor's request is real data.** Sample candidates on the desk come from PR 7's own sample data (Ruling 43), not from the contract.

## 5. The switch and the earned door

Aaron picked option B: the earned door, plus a switch "making it easy to switch between the two so they can always check out the talent team facing version".

**Ruling 41. What the switch does.**
- **Where it lives:** a two-option control, Candidate and Talent team, in the shell's top bar on every tab and at every width. Its slot comes from PR 6's shell work (at the right, before the avatar).
- **Talent team:** the candidate tabs hide, and the desk fills the main area. The switch is the way back, and the candidate side is exactly as it was left.
- **The control:** it has a pressed state, is reachable by keyboard, and keeps focus on itself when it flips.

**Ruling 42. The earned door.**
- After a candidate spends their request, the line where the intro button was reads (draft, for Aaron to edit): "Sent. It just landed on the speedrun team's desk. What does this unlock for them?" A button, "See the talent team's side", flips the switch. Aaron asked for this: "what does this unlock for the speedrun team?" and "how it would look like for the recruiter".
- The desk then opens with the visitor's card arriving in Requested. That's a short arrival, or a static highlight under reduced motion.
- **Flipping before spending:** the desk shows the sample requests, and the visitor's slot is a nudge card, "Your request lands here. Use it on a match to watch it arrive.", with a button back to Matches.

## 6. The desk

Aaron's pick: "B with the C drawer folded in". B is the loop as columns, and C is a by-role compare.

**Ruling 43. The board of stages.**
- **Columns:** Requested, With founder, Connected, Tracking, Outcome. Each shows a count.
- **Cards:** first name, company, role, and a status pill. About eight sample candidates sit across the columns, and the visitor's card is marked as theirs.
- **Phone:** the five columns become a stage strip of five pills with counts, above one column at a time. The walk selects the column the visitor's card is in. It's one component tree (my call).
- **Sample data:** sample candidates are made up, and live in `lib/speedrun/`.
  - Every sample card names a company from `FICTIONAL_COMPANIES`. Only the visitor's own card names a real speedrun company, because it's their real match.
  - The compare drawer's sample candidates are the exception: they picked the visitor's real role, which claims nothing about the company. They stay in the drawer and never become cards in With founder or a later column.
  - This extends the inbox rule ("Nothing in a sample inbox may name a real speedrun company") to the desk, so the page never shows an invented outcome at a real company (my call).
- **Founders are never named.**

**Ruling 44. The compare drawer.**
- Review on a Requested card opens a drawer that sets the candidate beside the one or two sample candidates who spent their pick on the same role.
- **Each person shows:** why they fit, why the role fits them, their most relevant project or experience, and one line.
- **Splits marks its suggestion,** which is the visitor in the narrated walk. Its button is "Send {name} to the founder".
- **The others carry "Send instead".** Choosing one:
  - marks that person "Sent instead" in the drawer;
  - passes the visitor's request (Ruling 40), so their next eligible match goes live in Requested.

  That's the stable-matching fallback, shown rather than described. The rival gets no founder panel, and no card in a later column (Ruling 43).
- **The drawer** is a panel, not a modal. Focus moves to its heading, and Escape closes it.
- **After any pass** (Send instead, or Not now in Ruling 46), the next match arrives as a new Requested card, and the walk resumes at Review on it. The founder panel only ever opens for the visitor's card.
- **With no next match,** the visitor's slot shows the nudge from Ruling 42.
- **Every path has a way out.** The finished sample (Ruling 48) is reachable from that state, and from Connected (my call).

**Ruling 45. Narration between actions.**
- Above the board, one line says what Splits is doing at each step. It's the same idea as the build log's lines, in its look, and announced politely. Aaron: "between each action it should also say something like ... to show where it brings value".
- **The beats,** with Aaron's two lines lightly edited and the rest drafts for him:
  - **Review:** "Splits lines up everyone who spent their one pick on this role, so the team can compare them side by side."
  - **Send:** "Splits then puts together a one-page profile so the founder can see the candidate's experience." (Aaron)
  - **The view shift:** see Ruling 46.
  - **Interested:** "Splits now helps the talent team make the warm intro." (Aaron)
  - **Not now:** "Splits frees {name}'s pick, and their next match goes live."
  - **Two weeks later:** "Splits keeps tracking: the first chat, the interviews, the offer."
- **An "acting as" chip** sits beside the actions on the desk. It reads "You're acting as the talent team", and changes at the founder step. That's the clear "whose view is this" without a toggle (my call).

**Ruling 46. The founder step.**
- After Send, the desk dims, and the one-pager opens as a framed panel headed "You're the founder now. This is what a founder at {company} would get." The chip reads "You're acting as the founder". Aaron: "it needs to be clear that we're shifting views for a second again. This doesn't mean adding a new toggle at the top".
- **The one-pager holds:**
  - the candidate's name and headline;
  - their most relevant project or experience (from `profile.shipped` and the resume);
  - their work;
  - link chips for LinkedIn, X and portfolio (any found in the resume text go live, and the rest show as inert placeholders);
  - "Why Splits matched them", from the fit brief;
  - the ask, "Are you interested in interviewing {name}?", with Yes and Not now.
- **Empty fields:** a section with nothing to show is left out. The fit brief and the ask always show, because every request carries match reasons. With no first name, "{name}" reads "this candidate" (my call).
- **Where the data comes from:** the visitor's card and one-pager read the contract's `candidate` fields. A sample person picked at join already has a first name, headline and `shipped` in `people.ts`. The desk's other sample candidates are authored in their own module (Ruling 43).
- Either answer closes the panel and returns to the desk, as the talent team. Not now passes the request (Ruling 40).

**Ruling 47. The connect.**
- On Yes, the card moves to Connected, and the drafted intro shows: to the founder and the candidate, the talent team copied.
- The team sends it with one press, "Send the intro". This follows Aaron's "Splits now helps the talent team make the warm intro", and supersedes my earlier call of no third gate.
- Nothing is sent. The button says sent, and the card says connected.

**Ruling 48. After the connect, a finished sample.**
- "Two weeks later" moves the walk to a sample card from last month, at a fictional company, already in Outcome. It opens its timeline:
  - intro, first chat, interviews, offer, hired;
  - both sides' survey answers;
  - the tag, a fit hit.
- **Why:** the visitor's own request names a real company, so its outcome is never invented (Ruling 43). The visitor's request stays at `connected`.
- The walk ends on "That's the loop.", with a button back to the candidate side.

**Ruling 49. The learned strip.**
- Under the board: "What Splits learned this month", labelled sample. It holds two or three lines, for example "3 of 5 misses at founding roles: wanted more senior", plus one people miss marked "matching unchanged".
- The finished sample's tag adds a line when the walk reaches it.
- It shows learning as patterns the team reviews, not as a model retuning itself.

**Ruling 50. The desk's opening lines** (drafts from Aaron's words, for him to edit):
- **Heading:** "what this unlocks for the talent team".
- **Under it:** "I don't know what your internal tools look like. Splits could live inside them as an internal tool, or beside them."

## 7. State and boundaries

**Ruling 51.**
- The switch and the desk's walk live in client state, beside `DemoState`, as the request does (Ruling 40). They reset on Start over.
- The desk's stage machine is pure, in `lib/speedrun/`, with tests, as `phase.ts` and `matchList.ts` are.
- No route, env or server change.

**For PR 6 to weigh, not owned here.** The Why tab could carry the loop's two product decisions:
- "One request, top pick only", because a spent pick is the signal;
- "Every intro teaches the matching", through the match-or-people survey.

## 8. Quality bars

- **Keyboard:** every action is reachable, with visible focus.
- **Founder panel:** focus moves to its heading on open, and back to the card on close.
- **Narration:** a polite live region.
- **Reduced motion:** no arrival motion and no typing. Each state renders in its end state.
- **Fit:** no horizontal scroll at 320, 375, 390, 768, 1280 or 1440. The desk never scrolls the document. Its panel scrolls inside the shell, as the tabs' panels do.
- **Code shape:** components under about 200 lines.

## 9. Testing

**vitest:**
- **The contract:** the transitions in Ruling 40 happen in order and never skip a gate, and a swap is refused once the request isn't `requested`.
- **Passing:** "Send instead" and Not now both pass the request and put the next ranked match live, or leave no live request when there is none.
- **The sample data:** no sample card names a real speedrun company, checked against the snapshot's companies. Drawer rivals are exempt, and the test also checks that they never reach a column past Requested.
- **The way out:** from every terminal state of the visitor's card, the finished sample is reachable.

**e2e.** Each pin names the regression it catches and must go red without its guard:
- spend the request (via PR 6's flow), take the earned door, and the visitor's card is in Requested;
- the switch works from every tab, and switching back restores the candidate side as it was;
- the full walk reaches Connected, then the finished sample;
- Not now, and Send instead, each put the next match live, on the desk and in the candidate's shortlist (PR 6).

Visual check at 390 and 1440 before reporting. Motion is timed in Playwright, never in the hidden pane.

## 10. Build order

PR 6 first, then this. The interface in Ruling 40 is agreed with PR 6's spec before either is built.

## 11. Open for Aaron

- **Every draft line in Rulings 42, 45 and 50.** He edits them, and I only fix mechanics.
- **My calls,** listed here so he can veto any one:
  - the phone stage strip (43);
  - the fictional-company rule for sample cards, with drawer rivals as the only exception (43, 44);
  - the walk resuming on the next match after a pass (44);
  - the "acting as" chip (45);
  - the finished sample after the connect (48);
  - the 3 and 5 day timeouts and the team's brief (section 3).

## 12. Rollback

Revert the branch's commits. Nothing touches server routes, env or the snapshot.
