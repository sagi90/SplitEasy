# SplitEasy

> Guest-first shared-expenses app (Splitwise-inspired). Create a group, split
> expenses fairly across multiple currencies, settle up — **no mandatory sign-up**.
> Built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

SplitEasy lets anyone start splitting expenses in seconds. A new visitor gets an
anonymous session, creates a group, and shares a link. Invitees join from a
brand-new browser with zero registration. Upgrading to a permanent account is
optional and preserves all existing data.

- **Guest-first**: anonymous Supabase auth, shareable invite/claim links.
- **Accurate money**: integer minor units, deterministic remainder allocation,
  multi-currency (ILS / USD / EUR / GBP).
- **Fair splits**: equal, exact, percentage, and weighted — all balance to the cent.
- **Balances & settlements**: net balances plus greedy debt-simplification transfers.
- **Localized**: Hebrew (RTL, default) and English, switchable at runtime.
- **Secure by design**: Row Level Security on every table, `SECURITY DEFINER`
  RPCs for writes, SHA-256-hashed invite tokens (raw token only ever in the URL),
  `Referrer-Policy: no-referrer` on invite/claim routes.

---

## Tech stack

| Area        | Choice                                             |
| ----------- | -------------------------------------------------- |
| Framework   | Next.js 14 (App Router, Server Actions)            |
| Language    | TypeScript (strict, `noUncheckedIndexedAccess`)    |
| Styling     | Tailwind CSS + CSS-variable theme                  |
| Backend     | Supabase (Postgres, Auth, RLS, RPC)                |
| Auth        | Supabase anonymous sign-in + cookie SSR sessions   |
| Validation  | Zod                                                |
| Unit tests  | Vitest                                             |
| E2E tests   | Playwright                                         |

---

## Prerequisites

- Node.js 20.19+ / 22.13+ / 24+ (project developed on Node 23; npm 10+).
- A Supabase project (free tier works).
- The Supabase CLI (optional, for applying migrations locally).

---

## 1. Install

```bash
npm install
```

> **Corporate proxy note:** if `npm install` cannot reach `registry.npmjs.org`,
> configure your proxy first, e.g.
> `npm config set proxy http://your-proxy:port` and
> `npm config set https-proxy http://your-proxy:port`.

---

## 2. Configure Supabase

1. Create a project at <https://supabase.com>.
2. **Enable anonymous sign-ins**: Dashboard → **Authentication → Providers →
   Anonymous** → toggle **on**. (Also review **Authentication → Rate Limits**;
   anonymous sign-ins are rate-limited per IP.)
3. **Auth redirect URLs**: Dashboard → **Authentication → URL Configuration**:
   - **Site URL**: your deployed URL (e.g. `https://spliteasy.vercel.app`) or
     `http://localhost:3000` for local dev.
   - **Redirect URLs**: add `${SITE_URL}/auth/callback`.
4. Copy the API credentials from **Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon / publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - service role key → `SUPABASE_SERVICE_ROLE_KEY` (**server only — never commit**)

### Apply the database migrations

The SQL lives in [`supabase/migrations/`](supabase/migrations/) and must be
applied **in order**:

| File                            | Contents                                           |
| ------------------------------- | -------------------------------------------------- |
| `0001_schema.sql`               | Tables, enums, constraints, indexes                |
| `0002_functions.sql`            | Membership helpers, group/invite/claim RPCs        |
| `0003_expense_functions.sql`    | Expense save/delete, settlements, member mgmt RPCs |
| `0004_rls.sql`                  | Row Level Security policies + grants               |
| `0005_peek_functions.sql`       | Public invite/claim preview RPCs                   |

**Option A — Supabase CLI**

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Option B — SQL editor**

Open the Supabase SQL editor and paste each migration file's contents in order,
running them one at a time.

---

## 3. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable                               | Scope   | Description                                  |
| -------------------------------------- | ------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | public  | Supabase project URL                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public  | anon / publishable key (browser-safe)        |
| `SUPABASE_SERVICE_ROLE_KEY`            | server  | service role key — **never expose/commit**   |
| `NEXT_PUBLIC_SITE_URL`                 | public  | Canonical URL for invite links & redirects   |

---

## 4. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the dev server                         |
| `npm run build`     | Production build                             |
| `npm run start`     | Start the production server                  |
| `npm run lint`      | ESLint (next lint)                           |
| `npm run typecheck` | TypeScript `--noEmit`                        |
| `npm test`          | Vitest unit tests                            |
| `npm run test:e2e`  | Playwright end-to-end tests                  |

### Verification status

All of the following pass on the current codebase:

- `npm run typecheck` — no type errors
- `npm run lint` — no warnings or errors
- `npm test` — **33/33** unit tests pass (money, splits, balances, tokens)
- `npm run build` — production build succeeds (17 routes)

> The Playwright E2E suite ([`tests/e2e/flow.spec.ts`](tests/e2e/flow.spec.ts))
> exercises the full guest flow (create → invite → join in a second browser →
> add expense → settle → reload). It talks to a live Supabase project and
> **auto-skips** when pointed at placeholder credentials. Configure a real
> project (with anonymous auth enabled) and run `npm run test:e2e`.

---

## Deploy to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build/output overrides are needed.
3. Add the environment variables (**Project Settings → Environment Variables**)
   for Production (and Preview if desired):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` → your Vercel production URL
     (e.g. `https://spliteasy.vercel.app`)
4. **Deploy.**
5. Back in Supabase, set **Authentication → URL Configuration**:
   - **Site URL** → your Vercel production URL
   - **Redirect URLs** → add `https://YOUR-DOMAIN/auth/callback`

---

## Architecture notes

- **Money** is stored as integer minor units (`BIGINT`). Currencies ILS/USD/EUR/GBP
  all use exponent 2. Equal splits distribute the remainder deterministically in
  member order (`10000 / 3 → [3334, 3333, 3333]`); percentage/weight splits use
  largest-remainder allocation so shares always sum exactly to the total.
- **Writes go through `SECURITY DEFINER` RPCs** (`create_group_with_owner`,
  `save_expense`, `record_settlement`, `accept_invite`, …) which enforce
  membership/authorization server-side. RLS protects every table for direct reads.
- **Invite & claim tokens** are generated with `crypto.randomBytes(32)` (base64url).
  Only the SHA-256 hash is stored in the database; the raw token exists solely in
  the shared URL. Invite/claim routes send `Referrer-Policy: no-referrer`.
- **Sessions** are anonymous Supabase users kept in HttpOnly cookies via
  `@supabase/ssr`; middleware refreshes them on every request.

---

## Project structure

```
src/
  app/            App Router pages, layouts, server actions, route handlers
  components/     UI primitives, forms, group views, i18n + toast providers
  lib/            money, splits, balances, tokens, validation, Supabase clients,
                  queries, auth, i18n
supabase/
  migrations/     Ordered SQL: schema, functions, RLS, peek RPCs
tests/
  unit/           Vitest: money, splits, balances, tokens
  e2e/            Playwright: full guest flow
```

---

## What requires your credentials / manual configuration

These steps cannot be automated and need your accounts/keys:

1. **Supabase project** — create it, enable **anonymous sign-ins**, and set the
   **Site URL** + **`/auth/callback` redirect URL**.
2. **Apply the migrations** in `supabase/migrations/` (CLI `supabase db push` or
   the SQL editor).
3. **Environment variables** — provide real values in `.env.local` locally and in
   Vercel for deployment (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL`).
4. **Vercel project** — import the repo and add the same environment variables.
5. **(Optional) Run E2E tests** against a live Supabase project.
