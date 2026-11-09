# /speedrun to its own zone: migration checklist (loop state)

Aaron, 2026-11-09: "Move it now", then: run the whole transition on a loop, and he jumps back in for product decisions.

The site lead's multi-zone default:
- /speedrun gets its own repo and Vercel project;
- `basePath: '/speedrun'`;
- the site serves it through one env-driven rewrite.

PR 112 (`claude/distracted-moser-bfd850`) is the only place speedrun code exists: `origin/main` has 0 speedrun files. So the site needs only the rewrite, and PR 112 closes unmerged once the zone serves /speedrun.

**How the loop runs.** Each iteration does the next unchecked step, verifies it, ticks it with a one-line note, commits this file, and reports milestones to the lead (`local_2d8302e7-12af-49b2-82f1-3d2fa0241ea2`).

**Hard rules:**
- Never merge or deploy, and never force push.
- Never `--push` the site's public sync.
- At most two Playwright runs at once, through `pwslot.sh`.
- Never stop ports 3220, 3221, 3276 or 3277.
- Switches stay off.
- No em dashes.
- Never enter credentials or create accounts.

**Defaults, unless the lead's conventions say otherwise:**
- **Repo:** `aaron-sulbaran/speedrun-splits`, private.
- **Local folder:** `~/Personal Projects/Personal Website/speedrun-splits`.
- **Next config:** `basePath: '/speedrun'`, with no assetPrefix (basePath already namespaces `/_next`).

## Steps

- [ ] 1. **Conventions.** Get the lead's answer on repo and project names, the rewrite env var, and assetPrefix. If there's no answer by step 4, use the defaults above and tell the lead.
- [ ] 2. **Docs.** Use Context7 for Next.js 16 multi-zones (basePath, assetPrefix, cross-zone links, `fetch` and public paths under basePath) and BotID under basePath. Record the facts that change code in the step note.
- [ ] 3. **Carve the history.**
  - Clone the site repo into the scratchpad, at PR 112's head.
  - Run `git filter-repo`, keeping:
    - `app/speedrun/`, `components/speedrun/`, `lib/speedrun/`, `lib/content/speedrun.ts`, `public/speedrun/`;
    - `e2e/speedrun*`, `scripts/speedrun-snapshot.mjs`;
    - the speedrun specs and plans under `docs/superpowers/`.
  - Rename `app/speedrun/` to `app/` and `public/speedrun/` to `public/`.
  - Check that the commit count and authorship look right.
- [ ] 4. **Scaffold the zone** on top of the carved history, as small commits:
  - package.json and the pnpm lockfile (the site's exact versions for next, react, tailwind, zod, ai, botid, the upstash packages, unpdf, lucide, vitest, playwright);
  - `next.config.ts` with the basePath;
  - tsconfig, eslint, postcss;
  - a tailwind config with only the tokens /speedrun uses;
  - `app/layout.tsx`: minimal chrome, meaning the logo linking to the site root, the theme init, and the fonts;
  - `app/globals.css`, with only the sections /speedrun uses;
  - `app/fonts/` (Profa, Aaron's file);
  - `lib/content/index.ts`, `lib/fonts.ts`, `lib/theme.ts` and `components/SiteLogo.tsx`, with only what's imported;
  - vitest and Playwright config, plus the e2e support files;
  - `vercel.json`, whose `ignoreCommand` skips non-main builds;
  - `.gitignore`;
  - AGENTS.md (living-docs protocol, Layer 1 copied from the site's rules that apply, its own Layer 2).
- [ ] 5. **Path fixups:**
  - `fetch` to the API routes;
  - `img` src values and the snapshot's logo paths;
  - links to the site (`/`, `/quick`, LinkedIn);
  - the share card as an absolute site URL;
  - BotID protect paths;
  - the snapshot script's output paths.
  - Remove what existed only for the public mirror (the leak-guard and public-email tests, the stand-in snapshot and logo) in one commit that says why.
- [ ] 6. **Verify locally:**
  - `pnpm install`, then `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`;
  - `pnpm start -p 3290` in a detached screen;
  - a browser check of `/speedrun` at 390 and 1440 (end states), the switch, the join card, Skip, and the network tabs;
  - the speedrun e2e under the slot script, on the zone's own ports.
- [ ] 7. **GitHub.** Create the private repo and push `main`. Vercel isn't connected yet, so nothing deploys.
- [ ] 8. **Vercel.** Create and connect the project only with Aaron's yes, because connecting it starts production builds. Otherwise this is his one click, and the env stays unset (switches off).
- [ ] 9. **The site rewrite.**
  - Send the lead the zone's production URL and the env name.
  - The lead opens the site PR, and Aaron merges it.
  - Then PR 112 closes unmerged.
- [ ] 10. **Hand over.**
  - Move the Splits spec and plan into the zone repo, and rewrite the plan's paths and constraints for the new repo.
  - Register the project in the vault (a wiki stub through the `new-project` conventions).
  - Report to the lead and Aaron. Then stop the loop.

## Notes
