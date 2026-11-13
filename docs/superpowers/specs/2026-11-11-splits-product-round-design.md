# Splits: the product round (design)

On 2026-11-11 Aaron looked at Splits on desktop, which is what the speedrun talent team will use. His verdict: the mobile view got all the design time, and the product behind the switch shows data without giving anyone a reason to act. This round turns Act 2 into a product where every surface answers "what do I do next" with one tap, and gives the desktop shell the design time it missed.

It ships as PR 6. The talent team's desk (the recruiter view) is PR 7, built on top of this one from its own spec (`2026-11-11-splits-recruiter-view-design.md`, written in the recruiter-view session). Rulings in this document run from 36 to 69.

## Aaron's words

These are his, quoted where they set the bar.

> "On the board page, there's lots of what I would consider 'dead data' like nice to haves but nothing that links the data together. Like the first thing they see doesn't offer anything, it doesn't say who it's with or no drop downs to explore at a glance what 'needs you' or what the user needs to be aware of at literal first glance. There's no triggers or motivation for users to continue interacting."

> "I think the paste in isn't that useful ... why would they go through the friction of pasting something in after having to hunt through their email, find it, and then cmd c and v. Too much friction, bad product decision."

> "having the flow chart be top of mind right under the big data points with then links to where those action items (offers can dropdown to show which companies, any deadlines, and links to take next steps like decide on offer etc.) can also help the user jump to the corresponding tab on the table. The table should also have dates, sorts, etc. just like my real recruiting table. Make the full product mockup that isn't too much additional code."

> "The 'today' and 'warm intros' section also suffer from dead data, they should have triggers towards actually doing something. It should prompt the user to apply if their to-do today is to finish an application, if it's an interview it should take them to their calendar link for that or the 'zoom' or 'gmeet' link. If it's interview prep, it should dropdown into what they need to know or relevant links ... Useful items for real people here, not just placeholder text."

> "For warm intro, it should state company, person (can be simulated for privacy) and maybe links to their linkedin and X profiles. For simulation purposes this can be me across all profiles with min/Max as the company name just to show real flow but the other warm intros can be mocked as well. It should also show the status like when it is if it's already scheduled, reply to email or follow up, also following the trend of nudging people in the correct direction."

> "This idea of nudging should be especially prevalent in the brief. Words in a brief are just words but words with action items and links to complete those action items is actually useful. Things should auto populate for the user if necessary and the agents are smart enough to execute and the user just needs a one tap decision for the human in the loop aspect"

> "the 'next: why' doesn't say anything, it should in reality be saying like 'why I built this' and then the actual why page doesn't say the why ... a one liner refresher here at the top would be useful ... and jumps straight into the product decisions I made (which would change based off my braindump here btw)."

> "users should be able to click on which matches they want to bring forward so that if they don't connect their gmail and import their current processes they can still start to build their splits board based off only speedrun recommendations and matches and users can also request warm intros and whatnot for specific companies. They can't spam the intro requests, just the top match they care about (think stable marriage problem)"

> "the toggles between matches, board, brief, and why aren't too clear and the user S or profile pic should 100% be in the top right corner of the product instead for familiarity to users."

## Goals

1. **Every surface ends in an action.** No row, card or line is only information. Each one carries a next step: a button that opens a pre-filled draft, a link to a real page, or a dropdown with what to know.
2. **First glance says what needs you, and with whom.** The board opens with the few things that need a decision today: the company, the person, the deadline, and a one-tap action for each.
3. **The numbers lead somewhere.** The stat tiles open to the companies behind them, and each one filters the table. The flow chart sits right under the tiles.
4. **The table reads like Aaron's real one.** It has dates, sorting and stage filters.
5. **The brief is a list of one-tap decisions.** Splits has already drafted the reply, found the times or opened the prep. The person only confirms.
6. **Candidates build their own shortlist from matches,** with no inbox needed, and spend one intro request on their top pick.
7. **The desktop shell reads like a product:** clear tabs, the avatar in the top-right corner, one content width.

## Non-goals

- Live Gmail, Calendar, Zoom or Meet. This is a mockup. Read and brief stay switched off, and the stage stays pilot (Aaron's S6).
- The talent team's desk, the founder step and the Candidate / Talent team switch's behaviour. Those belong to PR 7. This PR only leaves the switch's slot in the top bar.
- A phone redesign. Phones keep the shell as it is (the bottom dock) and get the new content stacked in one column. Phones must not break; they don't get a new layout pass.
- The join flow and the build log. They're unchanged except for where the shell touches them.

## Anti-goals

These would make the round a failure even if every test passed:

- **Fake affordances.** A button that looks live and does nothing (Aaron's ledger: "No fake affordances"). Every action does something visible in the demo: it opens the drafted thing, changes the item's status, or follows a real link. Where the real product would hand off to Gmail, Calendar or a meeting app, the demo shows the pre-filled thing in a sheet and says plainly that the real version would open there.
- **More dead data.** A new section with no action is the same mistake again.
- **Code sprawl.** Aaron asked for "the full product mockup that isn't too much additional code". New behaviour goes in pure functions over the data the board already derives. Rich detail is a small fixture for Sam, the "see Sam's board" path, and everyone else gets generic actions derived from their pipeline.

## Constraints

- These all hold from the repo's AGENTS.md:
  - tokens only, using the `sr-*` tokens inside `[data-speedrun]`;
  - all copy in `lib/content/speedrun.ts`;
  - no em dashes;
  - components under about 200 lines;
  - pure logic in `lib/speedrun/` with vitest;
  - e2e pins that name the regression they catch and are shown red first;
  - reduced motion respected;
  - Playwright through the slot script.
- Accessibility:
  - sheets trap focus and return it to their opener;
  - sortable headers carry `aria-sort`;
  - dropdowns are `details`/`summary` or buttons with `aria-expanded`;
  - status chips have text, not colour alone.
- Real links only where they're real:
  - Apply uses the role's URL from the snapshot;
  - LinkedIn uses Aaron's real profile from `lib/content.ts` socials;
  - everything else stays inside the page.
- **Aaron's copy:** every new line is a draft from his words, marked as a draft in the PR. He edits his copy; agents fix only mechanics.

## The design

### 1. The desktop shell (Rulings 36 to 41; S9's seven findings)

From lg up:

- **36. One top bar row.** The site's logo (fixed, top left, as everywhere on the site) and the product bar share a row. Remove the 80 px band that holds the logo alone above the bar today (`pt-20` from lg). The bar's left padding clears the logo. Phones keep today's arrangement.
- **37. The tabs read as navigation.** They sit left-aligned after the Splits wordmark and the concept badge, as text tabs:
  - unselected in `sr-ink2`;
  - the selected one in `sr-ink` with a 2 px underline;
  - no pill fills.

  The phone dock keeps its icons and pills.
- **38. The avatar sits in the top-right corner.** To its left there's an empty, fixed-width slot for PR 7's Candidate / Talent team switch: a `data-shell-switch-slot` element that renders nothing in this PR.
- **39. One content width.** The bar's inner edges and every tab's content share one max width and one left edge (about `max-w-6xl`, centred). Today Matches runs 208 to 1231 and Brief and Why 336 to 1104; they must line up.
- **40. The Next buttons stop looking like the selected tab.** "Next: Board" and the others become a secondary text link with an arrow, in the content column. Today they're the same black pill as the selected tab.
- **41. Matches' two panes share an edge.** The detail pane is sticky and as tall as the list's viewport, and its own content scrolls. The selected row is unmistakable: an ink border and the solid surface, while unselected rows take the HUD tone. Today it's a 1 px border only.

  **The primary action is the heaviest mark in the detail pane.** "Request a warm intro" (Ruling 44) is a filled button. When it's unavailable, Apply is the filled one. Follow, and the other button, stay secondary. Source: the design-review cold read on 2026-11-11. Shrunk to 480 px in greyscale, the black tab pill and the avatar read first and today's outlined action pills read last. Aaron: "Fold them in".

### 2. Matches: bring forward, rank, one intro (Rulings 42 to 45)

- **42. Bring forward.** Each match (the list row and the detail) gets a "Bring forward" toggle. Brought-forward matches form the candidate's shortlist, which shows on the Board (section 3). This works without connecting an inbox: the board builds from picks alone.
- **43. Ranked.** The shortlist is ordered: on the board, each pick has move up and move down controls, buttons and not drag. The first pick is #1.
- **44. One intro request, on #1 only** (the stable-marriage cap).
  - "Request a warm intro" is enabled only on the #1 pick, only when that match is eligible (its `connect` includes `"intro"`), and only when there is no live request.
  - Once it's spent, every other match shows "Your intro request is on {company}". That's a line, not a button.
  - While the request is still `requested`, the candidate can swap it to a different eligible pick: the swap moves the pick to #1 and the request with it. Once PR 7's desk moves it on, it's locked.
  - The request is bound to its match by `matchKey`, never by position, so reordering the shortlist doesn't move it.
  - This replaces today's "Ask for a warm intro" sheet text. The detail keeps Apply (the real URL) and Follow.
- **45. The intro request is the contract with PR 7,** as written in the recruiter-view spec's Ruling 70. PR 6 creates the module `lib/speedrun/introRequest.ts`, with the type, request creation, the swap, and the shared pure `pass` function. PR 7 adds its transitions to the same module.

  The type, per Ruling 70:
  - `candidate`: first name, headline, `profile.shipped`, and whether it's the visitor or a sample person;
  - `match`: the Match;
  - `ranked`: brought-forward match keys in rank order, the request's match first;
  - `fit`: `whyThem` from `match.reasons`, and `whyRole` from the intake;
  - `status`: `requested | withFounder | connected | passed`;
  - `introSent`;
  - `passedBy`: `team | founder`.

  Behaviour:
  - `pass(request)` marks the request passed and makes the next eligible match in `ranked` the live request, at `requested`. With none, there's no live request.
  - It lives in `DemoState`, with at most one live request.
  - In this PR its status never moves past `requested`; PR 7's desk moves it.
  - The shortlist (Ruling 53) and the board's warm intros show the live request's status as Requested ("the talent team reviews it next"), With founder or Connected.

### 3. The Board (Rulings 46 to 55)

Top to bottom on desktop, in one column of the shared content width. The order is fixed by importance.

- **46. The heading says whose board it is and how much needs them.** For example: "Sam's board" and "3 things need you today". The current subhead goes: "Built from your inbox" is no longer always true.
- **47. Needs you, first.** A short list, at most four, of what needs a decision today or this week, ranked by due date. Each item shows:
  - the company;
  - who it's with: a person's name and role, simulated;
  - what's needed;
  - the deadline;
  - one primary action button.

  Each item opens (a dropdown) to its context and secondary links. Sources: offers with a deadline, a founder's reply to an intro, an interview today or tomorrow, an assessment due, and a follow-up when an application has been quiet past its window. Pure: `needsYou(pipeline, details, today)` in `lib/speedrun/actions.ts`.
- **48. The stat tiles open.** Applied, In process, Intros and Offers stay as the big numbers. Each tile is a button:
  - it expands a short list under the tiles of the companies in that bucket, each with its deadline and next step (offers show which companies, their deadlines, and "Decide on the offer");
  - it filters the table below to that bucket;
  - pressing it again clears the filter.
- **49. The flow chart sits right under the tiles.** It's the existing FlowChart with the board's data, the full layout, no longer an arrangeable card. Clicking a stage node filtering the table is the builder's call, if it's cheap. The tiles already do the filtering.
- **50. The table works like Aaron's /recruiting table.** Columns: Company, Role, Stage, Applied (date), Last update (date), Next step (with its due date when one exists).
  - Every column header sorts; the default is Next step's due date, soonest first, then Last update newest first.
  - Stage filter chips: All, In process, Offers, Intros, Closed. The stat tiles set them too.
  - The Next step cell is an action link that opens the same sheet as the needs-you item.
  - "Show all N" stays for long boards.
  - Dates come from the events already derived (the applied event, `lastEventAt`) and from the details fixture for due dates.
- **51. Today.** Each item is a to-do with its action:
  - an application to finish: "Finish the application", the role's real URL where it came from the snapshot, otherwise a sheet;
  - an interview: the time, the interviewer, "Join" (a sheet showing the calendar event and a mock meeting link that says the real version opens Meet or Zoom) and "Add to calendar" (same sheet);
  - interview prep: opens to what to know (the company in one line, the role, who's interviewing, three prep points) and links to the company's site and the posting.
- **52. Warm intros.** Each intro shows:
  - the company;
  - the person: simulated, and per Aaron it's Aaron Sulbaran on every intro, with a monogram, no photo;
  - their role at the company;
  - LinkedIn (Aaron's real profile) and X;
  - a status chip;
  - the nudge action.

  The statuses and actions:
  - Requested: "The talent team reviews it next".
  - Founder replied: "Pick a time" opens three slots from your calendar; one tap.
  - Scheduled: shows the time; "Add to calendar".
  - Waiting: "Follow up" opens a drafted nudge after five quiet days.

  One intro uses min/Max as the company, to show the real flow; the others use the existing fictional companies. The candidate's own request (Ruling 44) shows here too.
- **53. Your shortlist.** The picks from Matches, ranked, with move controls, the intro request's state on #1, and a link back to Matches. When there are no picks: "Bring matches forward from the Matches tab and they land here", with the link. This is how a visitor with no inbox still gets a board.
- **54. The paste box is gone.** Remove `PasteEmail` from the board. Delete code only it used. Code the classifier and sample inbox still use stays.
- **55. Arrange is gone.** The hierarchy is fixed by what needs you. Remove the arrange toggle and the move, hide and show card controls, and the `boardOrder` and `hidden` state with their actions. The Tools card ("speedrun tools, where they help you") stays, last, as a plain section.

  This is my call, and Aaron can veto it. It contradicts the Why card "The board arranges itself", which section 5 rewrites.

### 4. The brief (Rulings 56 to 60)

- **56. Every brief line has an action.** The preview renders each item with its button. The rendered email keeps them as links.

  | Line | Action |
  |---|---|
  | A founder replied to your intro | Pick a time: three slots, one tap |
  | X wants a quick call | Reply with times: a drafted reply, one tap to send |
  | X wants to interview you | Confirm, plus Prep (the Today dropdown's content) |
  | An assessment is due | Open the assessment |
  | A new role fits you | Bring forward (adds it to the shortlist) or Apply |
- **57. Splits drafts, the person decides.** Each action opens a sheet whose content is already filled: a draft with "Splits drafted this", the slots, or the prep. One primary button confirms. Confirming:
  - marks the line done in the brief, with a quiet check and the line struck or dimmed, never removed;
  - updates the same item on the board, through shared demo state, so the needs-you count drops;
  - says "Sent" or "Added" plainly, and the sheet says the demo sends nothing.
- **58. One action module for the brief and the board.** The sheets the brief opens are the same ones the board's needs-you, Today, intros and table open. One action model drives all of them: `lib/speedrun/actions.ts` derives the actions, and one `ActionSheet` component renders them. No second copy of the drafts.
- **59. Fix the orphan "Every morning" line under the brief.** Cadence reads as a labelled setting, like "Where it reaches you". Keep the channel picker and the switched-off note (Ruling 33).
- **60. Done state is per visit.** Done items reset when the page reloads, like the rest of the demo state. Nothing goes to storage.

### 5. Why I built this (Rulings 61 to 64)

- **61. The tab and the Next link read "Why I built this".** It's the shell's last tab label too.
- **62. A one-line refresher at the top,** before the product decisions. Draft, from his hero lines: "I've sent 84 applications this fall, and some of my friends have sent 400. Splits is the tool I wanted on the other side of that." Aaron edits it.
- **63. The product decisions change with this round.**
  - **Keep,** with light edits where the build changed: "The brief comes first.", "AI suggests. You decide.", "Your inbox is read-only.", "Intros stay human.", "Founders get routed, not buried."
  - **Replace** "The board arranges itself." with "Every screen ends in a next step." (nudges: Today, intros and the board each carry the action).
  - **Add,** as drafts from his words:
    - "One tap for the human." (agents draft the reply, find the times, open the prep; you confirm);
    - "No pasting." (hunting for an email to paste is friction; the board builds from your inbox or from the matches you bring forward);
    - "One intro, your top pick." (the cap that keeps intros meaningful for founders and the talent team).
  - Aaron edits all of them.
  - PR 7 adds one more card when it ships the match-or-people survey: "Every intro teaches the matching." This PR doesn't add it, because it would describe something not built yet.
- **64. The close stays,** with Ruling 33's 80/20 copy.

### 6. Mock data (Rulings 65 to 67)

- **65. A details fixture for Sam,** in `lib/speedrun/details.ts`: the people, times, deadlines, prep notes and intro statuses for Sam's companies. It covers the Lumora Health intro reply, the Tarnmoor screen, the Cindermoor interview, the two offers with deadlines, a quiet application due a follow-up, and min/Max as one warm intro. Every person in it is "Aaron Sulbaran", with a role per company.
- **66. Everyone else gets generic actions from their pipeline:**
  - offers: "Decide on the offer";
  - interviews: "Prepare";
  - assessments: "Finish the assessment";
  - quiet: "Send a follow-up".

  They don't get named people or prep notes.
- **67. Dates are fictional and anchored to `INBOX_TODAY`.** No real company names except min/Max, which is Aaron's, and the real speedrun roles that already come from the snapshot.

### 7. What stays (Rulings 68 and 69)

- **68. The join flow, the build log, the switch, Act 1 and phones' shell are unchanged.** The phone gets the new content stacked, and must pass at 375 and 390 with no sideways scroll.

  **Every tap target in Act 2 is at least 44 by 44 px on phones,** made with padding or a larger hit box, not a bigger font. That covers the new controls, plus these existing ones the design review measured on 2026-11-11 at 390:
  - the close's links: My site 64x24, MVP 35x24, LinkedIn 92x24;
  - the table's "show all": 96x28;
  - the brief's channel pills: 36 px tall;
  - the account button: 40x40.

  The site's own logo is the site's chrome and is out of scope. Aaron: "Fold them in".
- **69. The e2e suite's existing flows keep passing.** Tests that pinned removed things (the paste box, arrange controls, the pill tabs) are rewritten or removed, each removal named in the PR.

## Settled after the builder check (my calls)

A fresh builder read the draft. These are its questions and my answers. Each one is my call, and Aaron can overrule any of them.

1. **Aaron's links on the intros.**
   - Every simulated founder links to Aaron's real LinkedIn, which is his ask: "this can be me across all profiles".
   - X renders only when an X URL is in `lib/content.ts` socials. Aaron gives the URL, or the cards show LinkedIn only.
2. **Sam's details are pinned, not looked up.** Sam gets fixed extra events, added the way `OVERNIGHT` adds them, without touching the seeded generator:
   - two offers with deadlines;
   - one application quiet past its window;
   - a min/Max intro.

   `details.ts` is keyed to those exact companies, and the inbox tests and e2e counts that change are updated, each named in the PR. That makes the 1440 check deterministic.
3. **Today is `INBOX_TODAY`; "this week" is the next six days.** The follow-up windows are:
   - an application at screen or later, quiet for 7 days;
   - an intro, quiet for 5 days.

   No-reply stays at the existing 21 days. Generic people have no due dates. Their needs-you rank by stage (offer, then interview, assessment, screen, quiet), then by `lastEventAt`, and the deadline cell shows how long it's been quiet ("quiet 9 days") instead of a date.
4. **Brief lines carry identity.**
   - `BriefItem` gains `company` and `actionKey`. The server and email schema may change, and the email keeps its links.
   - The action comes from the underlying event's kind and stage, never from the line's text.
   - A visitor with no inbox gets role lines only, and their actions are Bring forward and Apply.
5. **The board with no inbox and no sample person.**
   - It shows the shortlist, the live request and Tools.
   - Needs you, the tiles, the chart and the table are replaced by one line pointing to Connect and to Matches.
   - The heading reads "Your board". With a sample person it's "{Name}'s board".
   - A new build (`pickPerson`, `built`) or `reset` clears the shortlist, the request and the done set, because the matches change underneath them.
6. **Picks are per match,** keyed by `matchKey` as in Ruling 70. Any match can be brought forward, including a founder route without a role. The intro is per match, and eligible only when its `connect` includes `"intro"`. One company may have two picks.
7. **Tiles and chips.**
   - Applied clears the filter (All).
   - In process is open rows at assessment or later.
   - Offers is open rows at offer.
   - Intros is founder-lane rows, matching the stat. Its drop-down lists the warm intros.
   - Closed is rejected plus no-reply.
   - A row with no applied event shows a dash in Applied.
8. **State lives in `DemoState`, in the reducer.** It adds:
   - `done: string[]` (action ids);
   - `shortlist: string[]` (matchKeys, in rank order);
   - `introRequest: IntroRequest | null`.

   It removes `boardOrder`, `hidden`, `moveCard` and `toggleCard`. `events` and `addEvents` stay if anything besides the paste box uses them, and are removed only when nothing does.
9. **The PR 7 contract is the recruiter spec's Ruling 70,** as written in Ruling 45. `introRequest.ts` exports the type plus `createRequest`, `swapRequest` and `pass`.
10. **Phones.**
    - The table scrolls sideways inside its own container. The page never does.
    - Tile drop-downs and sheets stack full width.
    - Tools shows for visitors without an inbox, as today.

## Left to the builder

- Component split, and the sheet's look within the existing `sr-*` styles. Reuse today's connect sheet pattern if it fits.
- Small motion on state changes: a quiet check on done, a short expand on dropdowns. Use the `motion.ts` keys, and keep it reduced-motion safe.
- Whether chart nodes filter the table (Ruling 49).
- Exact copy for actions and statuses, as drafts, in `lib/content/speedrun.ts`.
- How the table's sort state is held (component state is fine).

## How we'll know it worked

- At 1440 on Sam's board, without scrolling, the visitor sees what needs them, with whom, by when, and a button for each.
- Every brief line's button leads to a decision that changes something visible on the board.
- No section on the board, the brief or Today is text without an action.
- The tabs, avatar and widths pass the drift checks at 1280 and 1440. Phones still pass at 375 and 390.
