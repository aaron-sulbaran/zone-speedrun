# /speedrun preconditions (D22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared, fail-closed limiter and a recipient allowlist to the read and brief routes so AI reading and the brief email can be switched on safely later. Nothing turns on.

**Architecture:** A pure adapter around `@upstash/ratelimit` (injected, faked in tests) returns the existing `LimitVerdict`. `liveFlags` requires the store, and the brief also requires a non-empty allowlist. Handlers take async limiter dependencies.

**Tech Stack:** Next.js 16.2 route handlers (Node runtime), TypeScript strict, zod, vitest, `@upstash/ratelimit@2.2.0`, `@upstash/redis@1.40.0`.

**Spec:** `docs/superpowers/specs/2026-11-08-speedrun-preconditions-design.md`

## Global Constraints

- Both switches stay off. No env file, test or script ever sets them on with a real store. Tests never touch the network.
- No raw IP address or email address reaches Redis, a log line or a test fake's recorded keys: SHA-256 digests only. Log lines carry the `[speedrun]` prefix and no keys, addresses or tokens.
- Fail closed: a missing store, a thrown error, or an Upstash result with `reason === "timeout"` is a denial, `{ ok: false, retryAfterMs: 60_000 }`. The Upstash `timeout` option is 1000 ms.
- Env names: the store is `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. The allowlist is `SPEEDRUN_BRIEF_ALLOW`. Never commit values.
- Pin dependencies exactly (no caret): `@upstash/ratelimit` 2.2.0 and `@upstash/redis` 1.40.0, installed with pnpm.
- Copy lives in `lib/content/speedrun.ts`. No em dashes. Use tokens only.
- Git: stage by name, small commits, each ending `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push.
- Before every commit run `pnpm vitest run && pnpm tsc --noEmit && pnpm lint`. Run `pnpm build` once per task.

## Review Focus

1. **A store that answers slowly.** Upstash's default lets the request through on timeout. Here a `reason: "timeout"` result must deny.
2. **A store with one of its two env vars set.** Detection returns null, so the feature is off. It must not be half-configured.
3. **An allowlist written with stray spaces, upper case, or a trailing comma.** Entries are still matched correctly, and an empty entry never matches everything.
4. **A subdomain of an allowed domain** (`a.example.com` against `@example.com`). It is refused.
5. **The daily cap.** It counts across the fleet, not per instance. One shared key per route.

---

### Task 1: The shared limiter

**Files:**
- Create: `lib/speedrun/sharedLimit.ts`, `lib/speedrun/sharedLimit.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml` (the two pinned dependencies)

**Interfaces:**
- Produces:
  - `type LimitStore = { url: string; token: string }`
  - `limitStore(env: Record<string, string | undefined>): LimitStore | null`. Checks the KV pair first, then the UPSTASH pair. Returns null unless both halves of one pair are non-empty.
  - `type WindowSpec = { prefix: string; max: number; window: \`${number} ${"s" | "m" | "h" | "d"}\` }`
  - `type RatelimitLike = { limit: (key: string) => Promise<{ success: boolean; reset: number; reason?: string }> }`
  - `createSharedLimiter(spec: { perKey: WindowSpec; daily?: { prefix: string; max: number } }, deps: { make: (w: WindowSpec | { prefix: string; max: number; window: "1 d" }) => RatelimitLike | null; now?: () => number; log?: (line: string) => void }): (key: string) => Promise<LimitVerdict>`
    - Digests `key` with SHA-256 before calling `limit`.
    - Checks the daily cap (key `"daily"`) first, then the per-key window.
    - A `null` from `make` means no store, and every call denies.
    - `success: false` gives `retryAfterMs = max(1, reset - now)`.
    - A timeout reason or a throw gives `{ ok: false, retryAfterMs: 60_000 }` and one log line, `[speedrun] limits unavailable`.
  - `upstashMaker(store: LimitStore | null): (w) => RatelimitLike | null`. Builds `new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(max, window), prefix, timeout: 1000, analytics: false })`, or returns null when the store is null. This is the only place the Upstash packages are imported.

- [ ] **Step 1: Write the failing tests** (`lib/speedrun/sharedLimit.test.ts`, using a fake `make` that records keys and returns scripted results):
  - **`limitStore`:**
    - the KV pair returns it;
    - the UPSTASH pair returns it;
    - a URL without a token returns null;
    - none returns null;
    - the KV pair wins when both are set.
  - **Verdicts:**
    - success then success gives `{ ok: true }`;
    - a per-key denial with `reset = now + 5000` gives `retryAfterMs 5000`;
    - a daily denial short-circuits, so the per-key fake is never called;
    - `reason: "timeout"` with `success: true` gives a 60,000 ms denial and one log line;
    - a throwing fake gives a 60,000 ms denial;
    - `make` returning null denies every call.
  - **Keys:** the recorded keys equal `sha256("203.0.113.9")` hex. The raw string appears in no recorded key, and the log line contains no key.
- [ ] **Step 2: Run them to see them fail.** `pnpm vitest run lib/speedrun/sharedLimit.test.ts` should FAIL.
- [ ] **Step 3: Install and implement.** Run `pnpm add -E @upstash/ratelimit@2.2.0 @upstash/redis@1.40.0` and confirm the two are compatible (peer ranges). Then implement per Interfaces.
- [ ] **Step 4: Run the checks and the build.** Run `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`. Everything should pass.
- [ ] **Step 5: Commit.** Message: "Speedrun page: a shared, fail-closed limiter over Upstash, faked in tests".

---

### Task 2: Wire the limiter into read and brief; the switches require the store

**Files:**
- Modify: `lib/speedrun/guard.ts` (`liveFlags`), `lib/speedrun/guard.test.ts`
- Modify: `lib/speedrun/readHandler.ts`, `lib/speedrun/readHandler.test.ts`, `lib/speedrun/briefHandler.ts`, `lib/speedrun/briefHandler.test.ts`
- Modify: `app/speedrun/api/read/route.ts`, `app/speedrun/api/brief/route.ts`

**Interfaces:**
- Consumes: `limitStore`, `createSharedLimiter` and `upstashMaker` (Task 1).
- Produces:
  - **`liveFlags(env = process.env)`** returns `{ reading, email }`.
    - `reading` is `SPEEDRUN_AI === "on" && limitStore(env) !== null`.
    - `email` is today's three conditions `&& limitStore(env) !== null && parseAllowlist(env.SPEEDRUN_BRIEF_ALLOW).length > 0`. Task 3 adds `parseAllowlist`. Until then, use a local placeholder that returns `[]`, so email reads off; Task 3 replaces it.
    - Each switch that is on but blocked logs one line naming the missing piece ("store" or "allowlist"), once per instance.
  - **`ReadDeps.allow`** becomes `() => Promise<LimitVerdict>`.
  - **`BriefDeps.allow`** becomes `(key: string) => Promise<LimitVerdict>` and **`allowIp`** becomes `() => Promise<LimitVerdict>`. The handlers await them.
  - **Routes:** each builds its limiters once at module scope from `upstashMaker(limitStore(process.env))` with the spec's numbers:
    - read: per key 5 per 10 m, prefix `speedrun:read`; daily 300, prefix `speedrun:read:daily`;
    - brief recipient: 3 per 1 h, prefix `speedrun:brief:to`;
    - brief caller: 3 per 1 h, prefix `speedrun:brief:ip`;
    - brief daily: 50, prefix `speedrun:brief:daily`. Give it to exactly one of the two brief limiters, so a request counts once.
  - The match route is unchanged. `createLimiter` stays for it.

- [ ] **Step 1: Write the failing tests.**
  - `guard.test.ts`: `liveFlags` with the AI switch on and no store is reading false; on with a store is true; the email switch on with a store but an empty allowlist is false.
  - Handler tests: move to async fakes. A read with `allow` resolving to a denial gives 429 with `retryAfterMs`. A brief with `allowIp` denying never calls `allow` or `send`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run the checks and the build.** Run `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`. Then run the speedrun e2e through the slot script (`.superpowers/sdd/2026-11-08-speedrun-onboarding/pwslot.sh`, ports 3152 and 3153) to confirm nothing regressed with switches off.
- [ ] **Step 5: Commit.** Message: "Speedrun page: read and brief limit through the shared store and fail closed without it".

---

### Task 3: The recipient allowlist

**Files:**
- Create: `lib/speedrun/recipients.ts`, `lib/speedrun/recipients.test.ts`
- Modify: `lib/speedrun/guard.ts` (use the real `parseAllowlist`), `lib/speedrun/briefHandler.ts`, `lib/speedrun/briefHandler.test.ts`, `app/speedrun/api/brief/route.ts`, `components/speedrun/act2/BriefSend.tsx`, `lib/content/speedrun.ts`

**Interfaces:**
- Produces:
  - `parseAllowlist(raw: string | undefined): string[]`. Splits on commas, trims and lowercases each entry, and drops empty entries. It keeps `@domain` entries and `local@domain` entries. Anything else is dropped (no wildcards).
  - `isAllowed(email: string, list: string[]): boolean`. Exact address match, or `@domain` match on the exact domain after the last `@`. Case-insensitive. An empty list gives false.
  - `BriefDeps.allowed: (email: string) => boolean`. `handleBrief` calls it after parsing and before both limiters. False returns `{ status: 403, body: { error: "not_on_list" } }`, and `BriefError` gains `"not_on_list"`.
  - The brief route passes `(email) => isAllowed(email, parseAllowlist(process.env.SPEEDRUN_BRIEF_ALLOW))`.
  - `BriefSend`: one line under the form that says who can receive the demo email (copy key `brief.send.listNote`), and a calm message for `not_on_list` (copy key `brief.send.errors.not_on_list`). Both live in the speedrun voice in `lib/content/speedrun.ts`. They only render when email is live.

- [ ] **Step 1: Write the failing tests.**
  - `recipients.test.ts`:
    - `" A@Example.com , @team.example ,, "` parses to `["a@example.com","@team.example"]`;
    - `isAllowed("a@example.com")` is true;
    - `"x@team.example"` is true;
    - `"x@sub.team.example"` is false;
    - `"x@example.com"` is false;
    - an empty list is false;
    - `"*"` and `"example.com"` without `@` are dropped.
  - `briefHandler.test.ts`: an off-list address gives 403 `not_on_list` with zero `allow`, `allowIp` and `send` calls.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run the checks and the build.** Run `pnpm vitest run && pnpm tsc --noEmit && pnpm lint && pnpm build`.
- [ ] **Step 5: Commit.** Message: "Speedrun page: the brief email goes only to addresses on Aaron's list".
