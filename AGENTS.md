# zone-speedrun

/speedrun on aaronsulbaran.com is Aaron Sulbaran's working concept for the a16z speedrun talent team. Its working name is Splits, and it is linked from his application for their Product Engineer role.

The page opens in Aaron's own look. A switch then hands off to a working demo in speedrun's style:
- an onboarding;
- a build log;
- day-one matches from a real snapshot of their jobs board;
- an inbox board;
- a morning brief.

It is a Next.js multi-zone. This repo serves everything under the basePath `/speedrun`, and the site reaches it through one rewrite driven by its `SITE_ZONES` env.

## Where things live

- **Live state, decisions waiting on Aaron, what's next:** the site's build board, https://claude.ai/artifact/Vq3NnRhYnfdqVSMqpFe5ae. The orchestrator writes it in the same turn each event happens.
- **Current increment:** the plans in `docs/superpowers/plans/` and the specs in `docs/superpowers/specs/`.
- **Decisions:** the board. Rulings before the move live in the site's PR, aaron-sulbaran/aaron-personal-website#112.
- **Production:** https://aaronsulbaran.com/speedrun, through the site, from Vercel project `zone-speedrun` in team `aaron-sulbaran-projects`.
- **Deploy:** Aaron merges to `main` and Vercel builds production. Agents never deploy.
- **Logs:** `vercel logs`, or the Vercel MCP.


## Living document protocol

Claude Code loads this file into every session in this repo, subagents included, so every line is paid for on every run. It holds only what an agent cannot learn from the code and what will still be true next week.

**Every checkout has this file.** AGENTS.md is tracked in git, so every worktree and every branch carries it. Read and edit the copy in your own checkout, never another checkout's; your edit merges with your branch.

**Two layers, two owners.** Layer 2, facts, belongs to the agents: invariants, gotchas, how to run and deploy, a short map. Agents rewrite it in place, without asking, whenever their work makes a fact new, wrong, or different, and commit that edit on its own (`docs(agents): <what changed>`). Layer 1, rules, is Aaron's: the stage, conventions, scope guardrails, tooling and roles. A substantive Layer 1 change (stage, scope, a convention, a new rule) is proposed once, as one diff on the board; Layer 1 housekeeping is applied directly and posted as one line on the board. Housekeeping means a rule that names a tool, skill, path, or command that no longer exists, a rule that contradicts how the repo verifiably works, or writing down a decision Aaron already made (quote it and its date). Git history is the review trail.

**Approved means applied.** Once Aaron says yes, on the board or in chat, the agent applies the change itself and commits it. Never ask Aaron to run an edit, and never ask him to approve the same change twice. If you can't apply it from where you are, hand it to the lead session that can, with Aaron's words quoted; don't hand it back to him. If Claude Code's permission system refuses an AGENTS.md edit (in auto mode its classifier can call it self-modification), that is a permission decision: never work around it; post the blocked edit on the board in one line and move on.

**Never in this file:** build status, in-flight work, PR lists, rankings of what's next, dated changelogs. They go stale within a day. Live state goes where "Where things live" points (the board, or the plan file); history is git and the PRs.

**Rewrite, don't append.** A fact that stopped being true is deleted, not struck through. A fact that changed is edited where it stands. Over budget means cutting the least load-bearing line.

**Budgets.** Whole file under 20,000 characters, Layer 2 under 6,000. Run `wc -c AGENTS.md` before any edit that grows it.

**Drift.** Code that contradicts a Layer 2 fact: fix the fact in the same session. Code that contradicts a Layer 1 rule: stop and tell Aaron; never work around a rule silently.

**Last verified.** Layer 2 ends with `Last verified: YYYY-MM-DD at <short commit>`. Update it whenever you check Layer 2 against the code, even if nothing changed.

**Stage.** Layer 1 names the stage (sketch, pilot, or live) and its bar. Match your rigor to it. Before building on any of these, stop and propose a stage change: the first user outside the team, a real bank, payment, or credential flow, storing personal data (emails count), a store listing or public launch, anything regulated.


---

# Layer 1: Rules (Aaron's)

Stage: pilot (set 2026-11-06 for the site; carried over with the move, 2026-11-09)
A PR per change with CI green before merge. Second-model review on anything touching auth, money, personal data, migrations, or permissions. Migrations reviewed before they apply, with a way back. Errors reach Aaron (monitoring, or logs someone reads daily). A written rollback, and a way to delete one user's data. Never test against real users' data.

## Stack

- **Framework:** Next.js 16.2 (App Router, `basePath: '/speedrun'`), React 19.2, TypeScript strict.
- **Styling and motion:** Tailwind 3.4 over CSS custom properties; Web Animations through `lib/speedrun/motion.ts`; Lucide icons.
- **Libraries:** zod for input, AI SDK 7 through the AI Gateway (off by default), Upstash Redis for shared limits, BotID, and unpdf for in-browser résumé text.
- **Tooling:** pnpm. Tests are vitest (`lib/**/*.test.ts`) and Playwright (`e2e/`, against a local production build, Chromium).

## Conventions

- **Tokens only.**
  - Act 1 uses the site's tokens (`--color-*`, Profa through `font-display` and `font-label`).
  - Act 2 uses the `sr-*` tokens scoped to `[data-speedrun]`.
  - Components never embed hex, and `bg-x/NN` emits nothing on `var()` colors.
- **Copy.**
  - All copy lives in `lib/content.ts` and `lib/content/speedrun.ts`.
  - First person, sentence case.
  - No em dashes anywhere: copy, comments, docs, commits.
- **Brand assets.** Never use speedrun's or a16z's font files: the act 2 faces are lookalikes from Google Fonts. Their logos are allowed (Aaron's call).
- **Paths and links.**
  - Links to the site are plain `<a href>` (a full page load), never `next/link`.
  - `img` and public paths, and `fetch` strings, carry `/speedrun` themselves.
  - External links use `target="_blank" rel="noopener noreferrer"`.
- **Code shape.** Components stay under about 200 lines. Pure logic goes in `lib/speedrun/` with tests. Comments only where the why is not obvious.

## Scope guardrails

- **`SPEEDRUN_AI` and `SPEEDRUN_EMAIL` stay off** until Aaron's stage-change ask. Each also needs the Upstash store, and email needs `SPEEDRUN_BRIEF_ALLOW`; without them both fail closed.
- **speedrun's site.**
  - Never fetch its `/jobs/*-ad00000` pages or work around its Cloudflare check.
  - Roles come only from its public jobs API, through `scripts/speedrun-snapshot.mjs`.
  - Browser research stops at any bot check.
- **Aaron submits his application himself.**
- **Flag, never block:** anything that grows the backend (a database, accounts, paid services). Name the cost, security and upkeep, and let Aaron decide.

## Tooling and agents

- **Roles.** Opus 5.5 orchestrates and reviews, implementers run on Sonnet 5.5, and Fable 5.1 does the end-of-build review. This writes down Aaron's standing ask: "Make sure Opus review agents actually go through and review what the Sonnet agents wrote." Codex is the second model on anything touching a visitor's résumé, email address or the limits.
- **Merges and deploys.** Merges to `main` only on Aaron's word. Agents never deploy, link the Vercel project, or trigger a production build.
- **Accounts and env.** Never enter credentials or create accounts: Aaron installs the store and sets env.
- **Playwright.** At most two runs at once on this Mac, through the shared slot script. e2e is Chromium unless `E2E_ALL=1`, which adds desktop WebKit; Safari does not focus a button on click (focus it from code) and macOS WebKit tabs only between form fields, so Tab pins press `tabKey(browserName)` from `e2e/speedrun-flow.ts`.
- **Docs.** Context7 for Next.js, React, Tailwind and the AI SDK.
- **Reporting.** Report milestones to the site's lead orchestrator, which gates this repo's PRs at 390 and 1440.

## Commands

- **Serve:** `pnpm build && pnpm start -p 3290`, then open `http://localhost:3290/speedrun`.
- **e2e against a running build:** `CI=1 E2E_BASE_URL=http://localhost:3290 pnpm exec playwright test`. Without `E2E_BASE_URL`, it builds and serves on `E2E_PORT` (default 3290).

---

# Layer 2: Facts (agent-maintained)

## Invariants

- **Fail closed.**
  - Read and brief run only with their switch on and a reachable store, and email also needs the allowlist. A missing, slow or erroring store denies (`lib/speedrun/sharedLimit.ts`, `liveFlags` in `lib/speedrun/guard.ts`).
  - The brief answers every valid submission with one 202 and delivers in `after()`, so the allowlist can't be probed.
- **One phase on screen at a time** (`lib/speedrun/phase.ts`), and the phase follows the demo step.
- **Motion values.** Every value the dev-only `?tune` panel tunes lives in `lib/speedrun/motion.ts`: the switch, the steps and the hero intro. A few fixed timings still sit beside their components (the matches cascade, BuildLog, Rise, and the switch line's fade), and the hero's 3,500 ms no-JS failsafe lives in `app/globals.css`.

## Gotchas

- **Route names.** Next prints routes without the basePath: `/` is the page at `/speedrun`, and `/api/*` serves `/speedrun/api/*`.
- **Snapshot logos.** Their strings keep the `/speedrun` prefix, and the files live in `public/companies/`.
- **Share card.** `metadataBase` is `https://aaronsulbaran.com`, so the share card is the site's `/opengraph-image`.
- **BotID** through the site's cross-project rewrite is unverified. Check it before switching read or brief on.
- **No analytics yet.** The insights script's root path would route to the site's project.
- **Browser checks.** A hidden built-in browser pane pauses rAF and Web Animations, so check end states there and time motion in Playwright.
- **Network chrome.** In the network phase the chrome is the shell's top bar plus the site's logo, and the pinned pill is hidden.
- **e2e pins** name the regression they catch, and must go red without their guard.

## Run and deploy

- **Env names** (values through `vercel env` on `zone-speedrun`, never in commits): `SPEEDRUN_AI`, `SPEEDRUN_EMAIL`, `SPEEDRUN_EMAIL_FROM`, `SPEEDRUN_BRIEF_ALLOW`, `RESEND_API_KEY`, `AI_GATEWAY_API_KEY`, and `KV_REST_API_URL` with `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` pair).
  - They are read at build, so a flip needs a redeploy.
  - Locally, use a dummy `AI_GATEWAY_API_KEY`.
- **Builds.** `vercel.json` builds production only. The site's `SITE_ZONES` points `speedrun` at this project's production `.vercel.app` origin.
- **Headers.** Security headers come from `lib/security/headers.mjs` on every response. noindex is set in the page and the layout.

## Map

- `app/`: the page and `api/{read,brief,match}`
- `components/speedrun/`: `act1/`, `act2/`, `phases/`, `shell/`, the switch and the experience
- `lib/speedrun/`: pure logic, `snapshot.json`, tests
- `lib/content/speedrun.ts`: the page's copy; `lib/content.ts`: the few site strings
- `lib/security/`, `scripts/speedrun-snapshot.mjs`, `e2e/`, `docs/superpowers/`

Last verified: 2026-11-10 at 950151f
