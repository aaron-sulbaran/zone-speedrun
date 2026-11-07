# /speedrun: the morning after you join (design)

Date: 2026-11-07. Owner: Aaron. Status: approved to build overnight (Aaron, 2026-11-06 late night, in chat: "write that design doc, write the plan, and then run the build overnight"). Calls I made without him are marked **(my call)** and listed at the end.

## 1. Why this exists

Aaron is applying to the a16z speedrun talent team's Product Engineer role. Their application asks for one idea, with a link, and says "Show us how you'd move one of those" goals: help more job seekers find work they love; grow the network (more signups, more people landing jobs); bring more founders to speedrun and the speedrun alpha fellowship. The link is `aaronsulbaran.com/speedrun`.

The idea, in Aaron's words: today, when you join the talent network, you get a confirmation that says you're in the system and they'll match you if there's a match. That's the problem. Joining should give you something on day one, built for you and nobody else: what you're targeting, where and why, your resume, your inbox, and then speedrun does the rest. It tracks your search, makes connections, matches you to real speedrun companies and roles, and stays proactive (it emails you). He built a version for himself (Talos plus the private `/recruiting` dashboard) and wants to show what it looks like for every member.

What they hire for, and how the page shows each: Product (the product decisions section and the flow itself), Design (the shift into their style, done cleanly), Ship (live on his domain, a real AI system, tests), Lived It (his own funnel, anonymized, opens the page).

## 2. Goals, non-goals, anti-goals

Goals
- A visitor from the speedrun team understands the idea in 90 seconds and can play with it for five minutes.
- The "this is different" moment: motion that makes it obvious the platform is building something just for you, from your answers, your resume and your inbox, not a generic list.
- Day-one value right after joining: the companies you match best with, why, and how to get connected or get started.
- A real system, not a wrapper: structured extraction, retrieval over a real snapshot of speedrun's companies and roles, ranking with reasons, deterministic fallbacks, tests and fixtures.
- It looks like their product (their logo, colors, layout and motion vocabulary) while plainly being Aaron's concept.
- Every screen keeps a one-click way back to Aaron's site.

Non-goals (tonight)
- Real Gmail or Google Calendar OAuth. Gmail read access is a restricted Google scope that needs Google's security review (weeks), and an unverified app is capped at test users with a warning screen. The demo uses sample inboxes and a paste-an-email box; the page says what production would do. **(my call, forced by Google)**
- Scheduled daily emails. They require storing visitors' emails, which is a stage change under AGENTS.md (pilot: "storing personal data (emails count)"). Tonight: a one-shot "email me this brief" that stores nothing. The daily schedule is designed, not built, and waits for Aaron's stage decision.
- The anonymize toggle on the private `/recruiting` dashboard (a privacy mode like Robinhood's). Aaron wants it; it touches private recruiting files, so it ships as its own PR. Tonight's page shows a mock of his dashboard with fudged numbers.
- Changing anything on speedrun's site or submitting their form. Aaron submits the application himself.

Anti-goals (a failure even if it works)
- Reads as AI slop: generic gradient headlines, "your board builds itself", vague promises. Their real pages are black and white, lowercase headlines with italic emphasis ("founders are *waiting* to meet you"); the gradient lives only in accents (progress bar, join button).
- A wrapper that pipes a resume into a chat model and prints prose.
- Anything that could pass for an official speedrun product out of context, or that collects credentials or payment details.
- Any private data from the rest of Aaron's site leaking into this public page or the public mirror.

## 3. Constraints

- Repo rules: AGENTS.md Layer 1 (stage pilot). Copy only in `lib/content/speedrun.ts`; no em dashes anywhere; first person in Aaron's voice; tokens only (no hex in components); Server Components unless motion or browser APIs need a client; reduced motion respected; components under about 200 lines.
- Pilot bar that applies: PR with green checks; second-model review (Codex) on the resume and email routes because they touch personal data; errors reach Aaron (server logs with a clear prefix; Vercel logs); a written rollback (section 10); never test against real users' data (fixtures only); a way to delete one user's data (trivially satisfied: nothing is stored).
- Their API: no auth, open CORS, Cloudflare rate limit at about 10 requests in 3 seconds. Fetch at build or snapshot time, never per visitor. Never fetch `/jobs/*-ad00000` (honeypot); never work around a Cloudflare challenge.
- Their marks: the official logo SVG their own site publishes as its organization image (`/skill/logos/base/svg/...`), used to denote them (Aaron's explicit call, 2026-11-06). Their font files are licensed and stay out; free lookalikes instead (Inter Tight for the sans, Roboto Condensed for labels and buttons), scoped to the route.
- Safeguards that make the logo use honest: a persistent "A concept by Aaron Sulbaran for the speedrun talent team. Not affiliated." line, placed beside the demo signup and pinned on the styled section; Aaron's own chrome (the AS logo and Menu pill) on screen the whole time; `noindex`; the demo signup has no password or payment fields, collects nothing, and says so on its face.
- Public mirror: Aaron chose public (2026-11-06: "make it public. Just make sure there's no private information from the rest of my website that leaks into it"). So `app/speedrun/**`, `components/speedrun/**`, `lib/speedrun/**` and `public/speedrun/**` get allow rules, plus a leak guard: a unit test that fails if any file under those paths imports from `components/recruiting`, `lib/recruiting`, `lib/hacktx` or `docs/content`, or contains a private term. Run `pnpm public:sync` without `--push` as a dry run before the PR.
- Paid services (flagged per Layer 1, Aaron decided): an AI model via the Vercel AI Gateway (Aaron: "I can have a paid AI key on a public server... it won't be that much of a cost") and an email provider (Aaron: "it should literally email them"). Agents cannot create accounts or enter credentials, so both are built behind environment variables and switch on when Aaron adds them. Without them the page still works end to end on samples.

## 4. The experience

Three acts on one page, about 90 seconds to watch, open-ended to play.

### Act 1: in Aaron's style (his tokens, Profa, his chrome)
- An opener in his words (section 7 holds the source; lightly edited, never rewritten): he loves how they approach helping people find startups, building one or joining one; why he's doing this (it's fun, and he wants into the startup world by understanding it well enough to help others break in); job hunting sux (the endless loop, landing an interview and hating the process); they're tackling it and he'd love to tackle it with them.
- His own funnel: a mock of his `/recruiting` dashboard (stat tiles, the Sankey, a few anonymized rows) with fudged numbers and no company names, built from synthetic data in a new public module. Never his real export.
- The turn: "I'm not building this for me. I'm building it for y'all. So it should look like y'all." and a button.

### The shift (about 1.1 s)
His sea-blue mask slides in from the right (480 ms, ease-in), a short line holds ("okay. y'all's style."), the page swaps to the speedrun theme underneath, and the mask slides off to the left (560 ms, expo-out) trailing their purple, aqua and cream gradient as it reveals their page. Reduced motion: a plain fade (240 ms out, 180 ms in). Triggered by the button or by scrolling past the opener; plays once per visit; a "Replay the shift" control sits in Aaron's chrome. Approved by Aaron in the mockup ("the transition works great").

### Act 2: in their style, the product
Their warm paper, black text, white cards, frosted controls; lowercase headlines with italic emphasis; condensed uppercase labels; their expo-out easing, count-ups and cascades. Their logo in the product's header as their own product would show it. The flow:

1. **Join** (a demo of their signup, made personal). Three questions instead of a form: what are you targeting (roles), where (places, remote), why (in a sentence). Then: drop your resume (live, when the AI key is set) or pick a sample person. Connect buttons for Gmail and Calendar are shown honestly: in the demo they load the sample inbox or open the paste box; a note says what production would do.
2. **Building this for you** (the moment that makes it different). A short, visible build that uses the visitor's own inputs: their targets and resume facts appear as they're read, then the corpus narrows on screen (300+ companies and every live speedrun role down to the handful that fit, filters naming the visitor's own answers), then the board assembles card by card with a line like "made for {first name}. No one else in the network gets this board." Their terminal style (dark panel, aqua cursor) for the build log; cascades for the board. About 6 to 8 seconds, skippable, reduced motion shows the finished board with the log as static text.
3. **Your matches** (day-one value). The companies you'd match best with, with the reason in your own terms ("you said infra, you shipped X, they're hiring Y"), the real open role when there is one, and how to get connected: request a warm intro (the talent team's job), follow the company, or apply. For the founder-heavy sample (and any resume that reads founder-heavy), a card says it plainly: you should think about applying to speedrun or the speedrun alpha fellowship, we can still add you to the talent network, with links to both applications.
4. **Your board.** The pipeline from your inbox: stat tiles, the Sankey (applications through screens and interviews to offers, with exits), a table with next steps. Sample inboxes vary by person and volume. A paste box takes a real email (a confirmation, a rejection, an interview invite) and the Sankey updates live. Works for founder-track searches too (accelerators and VCs as their own lane). Optional customization: hide or reorder cards (Aaron: "having the option for users is always kind of nice"); the default arrangement depends on who you are.
5. **The brief** (why you'd come back). The email you'd get tomorrow morning, rendered as an email: only what changed for you (a reply landed, a new role that fits posted overnight, a step is due, an intro accepted). Channel choice: email, text, or your own agent through their MCP server. A button sends it to you now (when the email provider is set; stores nothing). Cadence follows the person: a 5-application student hears only on change; a 500-application search gets a daily digest.
6. **Product decisions I made, and why.** Short cards in their style: the brief comes before the dashboard; the board arranges itself and editing is optional; AI suggests and you decide, nothing auto-applies (apply better to fewer); your inbox is read-only and never sends as you; intros stay human (the talent team makes them, the system tees them up); founder-heavy people get routed to speedrun and alpha, not buried in the job pool. Plus what I'd measure: signup completion, day-7 return (their pages already count returning visitors), intros requested and accepted, offers.
7. **Close.** Built by Aaron, how it's built (one paragraph, no jargon wall), links to his site, the 30-second version and LinkedIn. The not-affiliated line.

### People (precomputed samples, also the "no upload" path)
Five sample resumes, each with a sample inbox at a different volume (all made up; no real people or employers in negative events):
- **Maya**, software engineer, sophomore, summer 2027 internships, about 5 applications (depth: quiet unless something moves).
- **Ravi**, AI engineer, new grad, about 60 applications, wants an applied AI team.
- **Sam**, product engineer, senior in ECE, co-op or new grad, about 150 applications, two founder intros (closest to Aaron).
- **Lena**, product designer, two years in, about 40 applications, portfolio-led.
- **Dev**, founder-heavy, laid off from a big-tech infra team, has built two side companies, applying to accelerators and a few founding roles, about 500 touches (triage), routed to speedrun and alpha.

Names and details are mine **(my call)**; Aaron can swap any.

## 5. How it works (the system)

- **Corpus snapshot** (`lib/speedrun/snapshot.json`, committed): every speedrun portfolio company from their collections endpoint and every live speedrun role, plus early-career a16z portfolio roles and founding roles, fetched by a paced script (about 1 request per second, `?source=portfolio-research`, a generic user agent) with company, title, location, function, seniority, comp, cohort, posted date, URL, and a short description excerpt. Validated with zod on read. Refreshed by rerunning the script; the page shows the snapshot date.
- **Resume reader** (`/speedrun/api/read`, a Node route): accepts a PDF or text resume (4 MB cap) and the three intake answers. Text extraction (no storage, in memory only), then one structured-output model call that fills a strict schema (targets, roles, seniority, skills, shipped things, signals of founder intent, locations), validated by zod. If the model fails or no key is set, a deterministic extractor runs on the text (keywords, sections) so the flow never dead-ends.
- **Retrieval and ranking** (pure, in `lib/speedrun/`): filters from the visitor's answers (function, seniority, place), lexical scoring of skills and targets against role and company text, company-level aggregation, then an optional model rerank of the top 20 that must cite fields from the corpus for every reason (reasons with no citation are dropped). Deterministic ranking is the floor and is what the samples and tests exercise.
- **Inbox to pipeline** (pure): an email classifier that maps a message to an event (applied, assessment, screen, interview, offer, rejection, intro, no reply) with rules first and the model as a fallback for unclear text, then the same stage math as the Sankey. The paste box runs it live.
- **Brief composer** (pure): diffs today's board against yesterday's and picks at most three items by priority, then renders an email (HTML and text). `/speedrun/api/brief` sends it when `RESEND_API_KEY` and a verified sender are set, rate limited, fixed template only (no visitor free text in the email), stores nothing.
- **Guards**: per-IP rate limits on both routes (best effort, in memory, like the existing HackTX brake) plus a daily cap; request size caps; model output token caps; no logging of resume text or email addresses; errors logged with a `[speedrun]` prefix.
- **Models**: AI SDK through the Vercel AI Gateway with a `provider/model` string (a fast Claude model for extraction and rerank). Builders read the installed AI SDK docs before writing calls. Tests use the AI SDK's mock model; nothing in CI calls a real model.
- **Sankey**: a new public module (`lib/speedrun/funnel.ts` plus `components/speedrun/Sankey.tsx`) using `d3-sankey`, written fresh. Nothing is imported from the private recruiting code.

## 6. Look and motion

- Act 1 uses the site's existing tokens and fonts.
- Act 2 uses a route-scoped theme: CSS custom properties under `[data-speedrun]` in `app/globals.css` (their palette, gradients and radii, from `docs/research/inspiration/2026-11-06-speedrun-talent-network.md`), Tailwind tokens mapped to them, Inter Tight and Roboto Condensed loaded with `next/font` only in this route. Components never embed hex. This needs a Layer 1 exception (section 9).
- Motion: one easing, `cubic-bezier(.16,1,.3,1)`; short durations (menus .16 s, steps .26 s, cascades .42 s, count-ups 1.1 s); the shift reuses the `/quick` transition's timing and Web Animations approach, written as its own component for this page. Every animation has a reduced-motion branch.
- Responsive: 390 px and 1440 px are checked by eye; the flow stacks on phones; nothing scrolls sideways.
- Easter egg (P2): one classic meme, hidden, found by the curious (Aaron: "more of an Easter egg"). Image choice is Aaron's; tonight ships the trigger and a placeholder frame only if time allows.

## 7. Copy

All strings in `lib/content/speedrun.ts`. Act 1 copy comes from Aaron's dictated answer (kept in this session's transcript, not in the repo), lightly edited for mechanics only, marked for his edit in the morning. Act 2 copy follows their voice: lowercase headlines with italic emphasis, Title Case on buttons and section labels where their product does, numbers as floors, no hype. Placeholder headline: "you joined. now *what*?" The not-affiliated line is Aaron's to word; tonight's draft: "A concept by Aaron Sulbaran for the speedrun talent team. Not affiliated."

## 8. What success looks like

Done when the PR shows: the route renders logged out with no keys set; the shift plays and degrades; each sample person runs the whole flow; the paste box moves the Sankey; with a fake key in tests, the routes validate, rate limit and fall back; the leak guard passes; typecheck, lint, unit tests, targeted e2e and a production build pass; screenshots at 390 and 1440 px; the public sync dry run passes.

## 9. Proposed Layer 1 change (one diff for Aaron)

Under Conventions, add: "`/speedrun` is the one exception to the single accent, the font list and the no-pure-black rule: its styled section uses a route-scoped speedrun theme (`[data-speedrun]` tokens, Inter Tight and Roboto Condensed, their gradient as an accent only) and their official logo with a persistent not-affiliated line." Under Stack, replace "AI: none" style wording with: "AI SDK via the Vercel AI Gateway for `/speedrun` only; nothing stored." Under rate limiting, note the two public speedrun routes.

## 10. Rollback

Revert the PR's merge commit; the route disappears and nothing else depended on it. Remove `AI_GATEWAY_API_KEY` (or the gateway OIDC usage) and `RESEND_API_KEY` from the Vercel project to stop spend immediately; the page keeps working on samples.

## 11. Calls I made without Aaron (check these)

- Gmail and Calendar are simulated plus a paste box, because Google's review for inbox access takes weeks.
- One-shot "email me this" instead of a daily schedule, because a schedule stores emails (stage change).
- The five sample people, their names, volumes and details.
- The placeholder headline and the draft not-affiliated line.
- The fonts Inter Tight and Roboto Condensed as stand-ins.
- A deterministic extractor and ranker as the floor under the model, so the page never dead-ends without a key.
- Resend as the email provider (it has a Vercel Marketplace integration and a plain HTTP API); swappable.
