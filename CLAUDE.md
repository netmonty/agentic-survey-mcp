# CLAUDE.md — project guide

Guidance for anyone — human or agent — working in this repo. It captures what the
project is, how it's laid out, how to build/test/run it, and the architectural decisions
already made (so they aren't re-litigated).

## What this is

**Agentic Survey MCP** — an open-source (MIT) MCP server that lets a user's own AI
agent build surveys and read results, written into the **user's own Supabase**. Users
own their data (own Supabase), carry their own AI cost (own agent), and their secret key
never leaves their machine. A stateless Next.js page-service renders the public survey
page respondents fill out and writes submissions straight into the user's Supabase.

By default the MCP server points at a maintainer-hosted page-service, so anyone can
publish share links out of the box. Self-hosters can point it at their own deployment
with `init --page-endpoint`.

Full specs: [`docs/survey-mcp-build-brief.md`](docs/survey-mcp-build-brief.md),
[`docs/survey-mcp-saas-plan.md`](docs/survey-mcp-saas-plan.md),
[`docs/trust-model.md`](docs/trust-model.md), [`docs/spike-findings.md`](docs/spike-findings.md).

## Layout (npm workspaces monorepo, Node ≥ 20)

```
packages/schema        SQL migration (migrations/0001_init.sql) + shared TS types + get_results contract
packages/core          pure service layer over an injected Supabase client; typed Result, never throws
packages/mcp-server    MCP server (stdio) + `agentic-survey` CLI; 14 tools over core
packages/page-service  Next.js 16 + React 19 public page (render + collect); self-hostable
docs/                  build brief, saas plan, trust model, spike findings
examples/              claude_desktop_config.json, sample config, sample-survey prompts
```

## Status — what's built

- ✅ **schema**: migration applied + verified; RLS proven (see spike findings).
- ✅ **core**: all functions + `get_results` aggregation; integration tests pass.
- ✅ **mcp-server**: 14 tools, CLI `init` (default cmd = serve the stdio server; `init` = setup), stdio smoke test passes.
- ✅ **page-service**: Next 16 + shadcn UI, all 10 question types (incl. date/time/slider) + dropdown variant, two themes, themed number stepper; lib spike test passes.
- ✅ **branching / skip logic**: `questions.logic` is typed (`QuestionLogic`); `set_question_logic` + `validate_survey` tools; a shared evaluator (`page-service/src/lib/logic.ts`) drives live show/hide and visibility-aware submission validation (hidden questions aren't required; answers to hidden questions are rejected). Conditions reference earlier questions only. DB-less unit tests in `logic.test.ts` / `lint.test.ts`.
- ✅ **date / time / slider question types**: date (`YYYY-MM-DD`), time (24-hour `HH:MM`), slider (numeric, defaults 0–100 `%`). Slider aggregates as numeric; date/time as text. Fresh installs get them from the updated `0001_init.sql`; **existing deployments must run `migrations/0002_add_question_types.sql`** (it alters the `questions.type` check constraint).
- ✅ **packaging**: schema/core/mcp-server build to `dist` via `tsc -b` (project references); publishable; `bin` → `dist/cli.js`. (page-service is deployed, not npm-published.)

## Run it locally

```bash
npm install
npm run build         # tsc -b for schema/core/mcp-server (dist/)
npm test              # core + mcp-server + page-service lib (needs .env; see below)
npm run typecheck     # all packages, 0 errors expected
npm run dev --workspace @agentic-survey/page-service          # editorial theme
BRAND_THEME=charcoal npm run dev --workspace @agentic-survey/page-service
```

## Testing against Supabase

Tests run via **tsx + node:test** and read Supabase creds from a gitignored root `.env`
(loaded with `--env-file-if-exists`). Use your **own throwaway** Supabase project — never
a shared or production one. Create a free project, run
`packages/schema/migrations/0001_init.sql` against it, and put its URL + `sb_secret_…` key
in `.env`. See [`CONTRIBUTING.md`](CONTRIBUTING.md). Tests create and clean up their own data.

## Self-hosting the page-service

`packages/page-service` (Next 16) is a standalone, deployable app and **holds no Supabase
keys** — the client-safe publishable key arrives with each share link, and submissions
write directly to the survey owner's Supabase. Deploy it to any Next-capable host with:

- project root set to `packages/page-service`, framework Next.js,
- public access (no deployment protection — the survey page must be reachable by
  respondents),
- optional env: `BRAND_THEME` (`editorial`|`charcoal`), `BRAND_NAME`, `BRAND_URL`,
  `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

The landing page is `packages/page-service/public/landing.html` (static), served at `/`
via a `next.config` rewrite. Edit it there and redeploy.

> The deploy runbook for the default maintainer-hosted instance, plus hosting/ops config,
> lives in a separate private repo and is not part of the open-source product.

## Decisions already made (don't redo)

- **Data model**: choice options live in `questions.config` jsonb as `{id,label}`;
  answers store `{optionId,label}` (rename-proof + readable). `public` schema, clean
  table names. Anonymous responses only (extensible later).
- **RLS** (verified with the real publishable key): the `anon`/publishable path can read
  only *published* surveys+questions and INSERT responses+answers — nothing else.
  Consequences baked into the code:
  - the public write path uses **client-generated UUIDs and NO `RETURNING`** (Postgres
    applies SELECT policies to RETURNING; responses/answers have no anon SELECT policy).
  - the **answers insert policy validates via the question's survey**, not via responses
    (anon can't read responses); the FK enforces the response link.
- **Keys**: the secret key is NEVER a tool argument — it's stored locally via `init`, and
  tools read it from local config/env. Migration is run **out of band** (SQL editor /
  `supabase db push` / Supabase MCP) — the product holds no management token.
- **page-service is self-contained**: it mirrors the few schema types locally
  (`src/lib/types.ts`) instead of importing `@agentic-survey/schema`, so it builds
  standalone as a deployable app. Keep these in sync with `packages/schema`.
- **Themes**: two built-in, selected by `BRAND_THEME` env — `editorial` (warm paper +
  Fraunces/Hanken + clay) and `charcoal` (monochrome charcoal/white + Geist + compact).
- **Runtime**: **Next 16 + React 19** (cleared the Next DoS advisories).

## Security posture (hosted page-service)

The hosted page-service is an **open, ungated, multi-tenant renderer**: anyone with their
own Supabase + this schema can serve their published surveys at
`/s/<ref>/<id>#k=<key>`, no account or permission needed. This is by design (a stateless,
self-hostable page), but it means strangers can host **plain-text phishing /
social-engineering content** under a shared hosted domain. (Code injection is *not* a
risk — React escapes all author text; no `dangerouslySetInnerHTML`.) Submissions write to
**the author's own** DB; there's no risk to the host's data or keys.

- **Launch posture: open + minimal hardening**, with denylist/reporting deferred.
- **Shipped hardening**: `ref` is validated against `^[a-z0-9]{20}$` before URL
  interpolation (closes a server-side SSRF on `/api/submit` and constrains rendering to
  real Supabase projects); security headers — `X-Frame-Options` / CSP `frame-ancestors`
  (clickjacking), `nosniff`, `Referrer-Policy` globally, plus a strict CSP and `noindex`
  on `/s/*`.
- **Still open**: enable Turnstile (set the two env vars; code already supports it); a ref
  **denylist** + abuse-report route to pull bad surveys fast; move the in-memory per-IP
  rate limiter (10/min, resets per serverless instance — weak) to a shared store or rely
  on a platform WAF.
- **Fast lever if abuse appears**: lock a hosted instance to an allowlist of known project
  ref(s) and push everyone else to self-host (`init --page-endpoint`).

## Publishing the packages

Packages are publish-ready: `publishConfig.access=public`, repo/homepage/keywords
metadata, per-package README + LICENSE, `prepublishOnly: tsc -b`. Publish in dependency
order: **schema → core → mcp-server**. After publish, `npx @agentic-survey/mcp-server init`
works for everyone.

## Gotchas

- `dist/` and `.next/` are gitignored; build with `npm run build` (publishable pkgs) /
  `next build` (page-service). Tests don't need a build (tsx resolves via tsconfig paths).
- Some hosts' server-side build of this monorepo can fail in the lint/type step; building
  locally and deploying the prebuilt output is a reliable fallback.
