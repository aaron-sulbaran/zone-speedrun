# /speedrun: preconditions for live reading and the brief email (design)

Board item D22. Aaron's answer: "Start the preconditions". This builds them and **turns nothing on**. Both switches (`SPEEDRUN_AI`, `SPEEDRUN_EMAIL`) stay off. Flipping either one is the stage change and gets its own board ask. Aaron installs the store himself, because agents never create accounts. Decisions he didn't state are marked **(my call)**.

## 1. Why

Codex's whole-branch review on 2026-11-07 called the page "safe with switches off, not safe on". It named three gaps, carried in the PR as R11, R34 and R51:
- **In-memory limits.** Today's limits live in each server instance's memory. On Fluid Compute that means a new count per instance, so they cap nothing across the fleet.
- **No recipient ownership.** The brief email will send to any address typed into the form.
- **No spend ceiling.** Only an AI Gateway budget caps model spend, and that has to be set by hand.

This work closes the first two in code. The third stays Aaron's step.

## 2. Goals, non-goals, anti-goals

**Goals**
- One shared limiter, backed by an Upstash Redis store from the Vercel Marketplace, for the two routes that spend money or send mail: `/speedrun/api/read` and `/speedrun/api/brief`.
- **Fail closed.** If the store is not configured, unreachable or slow, those two features act as off. This holds even with their switch on.
- The brief email goes only to addresses Aaron allows.
- Everything is testable with no network.

**Non-goals**
- Turning anything on.
- Moving the match route's limit. It costs nothing and stays on the in-memory limiter.
- Accounts, stored recipients, double opt-in flows, or a database.

**Anti-goals**
- Storing a raw IP address or email address anywhere, Redis included.
- A limiter that "fails open". Upstash's `timeout` lets requests through by default, so a timeout must count as a denial here.
- Any path where a switch set to `on` without the store spends money or sends mail.

## 3. The design

### The store
- **Integration.** Upstash Redis through the Vercel Marketplace (`vercel integration add upstash`), run by Aaron.
- **Env vars.** The integration sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Also accept `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. **(my call:** either pair works**)**.
- **Packages,** pinned exactly:
  - `@upstash/ratelimit@2.2.0`, published 2026-09-23.
  - `@upstash/redis@1.40.0`, published 2026-10-26.

  Both are at least about two weeks old. Check that they're compatible with each other.

### The shared limiter (`lib/speedrun/sharedLimit.ts`)
- **Detection.** `limitStore(env)` reads the env and returns the URL and token, or `null`.
- **Limiter.** `createSharedLimiter(opts)` returns `(key: string) => Promise<LimitVerdict>`. It reuses the existing `LimitVerdict` type from `guard.ts`.
- **Algorithm.** A sliding window per key, plus a fixed daily cap per route keyed `daily`, both through `@upstash/ratelimit`.
- **Prefixes.**
  - `speedrun:read`
  - `speedrun:brief:to`
  - `speedrun:brief:ip`
  - `speedrun:read:daily`
  - `speedrun:brief:daily`
- **Keys** are SHA-256 digests (of the address or the email), never the raw values.
- **Timeout.** 1,000 ms. A `reason === "timeout"` result, a thrown error or a missing store all count as denials, returning `{ ok: false, retryAfterMs: 60_000 }` and logging `[speedrun] limits unavailable` with no key in the log.
- **Testability.** The Upstash calls sit behind a small injected interface, so tests use a fake and never the network.

### The switches (`liveFlags` in `guard.ts`)
- `reading` means `SPEEDRUN_AI === "on"` **and** a store is configured.
- `email` means today's conditions **and** a store is configured **and** the recipient list is non-empty.
- If a switch is on but the store or the list is missing, the feature reports off and the server logs one line saying why, with no secrets.

### The limits (my call: today's numbers, now shared)
| Route | Limit |
|---|---|
| Read | 5 per 10 minutes per address, 300 a day overall |
| Brief | 3 an hour per recipient digest, 3 an hour per caller address, 50 a day overall |

### Recipient allowlist (`lib/speedrun/recipients.ts`)
- **The list.** `SPEEDRUN_BRIEF_ALLOW` is a comma-separated list of exact addresses (`name@domain`) and whole domains (`@domain`). It is set with `vercel env` and never committed. **(my call:** an allowlist Aaron curates, not double opt-in, because double opt-in needs stored tokens and a second email**)**.
- **Matching.** `parseAllowlist(raw)` and `isAllowed(email, list)`:
  - case-insensitive and trimmed;
  - a domain entry matches that exact domain only, not its subdomains;
  - an empty or missing list allows nobody.
- **The handler.** `handleBrief` checks the list after parsing and before the limiters. A refused address returns `403` with `{ error: "not_on_list" }`. That uses no limiter capacity and sends nothing.
- **The page.** When email is on, the Brief tab says who can receive the demo email: one line, in the speedrun voice. A refused address shows a calm message rather than an error tone. All copy lives in `lib/content/speedrun.ts`.

### Routes
- `app/speedrun/api/read/route.ts` and `app/speedrun/api/brief/route.ts` swap `createLimiter` for the shared limiter.
- Handlers take async `allow` / `allowIp`.
- `handleRead` and `handleBrief` await them, and their tests move to async fakes.
- The match route is unchanged.

## 4. Testing
- **vitest** with fakes only:
  - store detection, for both env pairs and for none;
  - a verdict for success, for a denial with a reset, for a timeout denial, for an error denial, and for a missing store;
  - keys are digests (assert no raw address reaches the fake);
  - `liveFlags` with each missing piece;
  - the allowlist: exact, domain, case, whitespace, subdomain refused, empty list;
  - `handleBrief` refusing an off-list address before any limiter or send;
  - `handleRead` and `handleBrief` with async denials.
- **e2e:** unchanged. Both switches stay off in every build the suite makes.
- **Second-model review:** Codex, before reporting, because this touches a stranger's résumé and email address. Fix or log every finding.

## 5. Aaron's steps (board asks, in this order, when the code lands)
1. Install Upstash Redis for the `aaron-portfolio-website` project (Marketplace, his account).
2. Set an AI Gateway budget cap and confirm zero data retention for the model.
3. Set `SPEEDRUN_BRIEF_ALLOW`.
4. Separately, the stage change: flip `SPEEDRUN_AI` and/or `SPEEDRUN_EMAIL`, then redeploy.

## 6. Rollback
Unset the switches. This also happens if the store is removed, because the routes fail closed. The code can stay.
