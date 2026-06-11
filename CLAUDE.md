# CLAUDE.md — agent handoff & project state

Read this first. It captures what this project is, what's built, how to run/deploy it,
the decisions already made (don't re-litigate them), and what's left.

## What this is

**Agentic Survey MCP** — an open-source (MIT) MCP server that lets a user's own AI
agent build surveys and read results, written into the **user's own Supabase**. Users
own their data (own Supabase), carry their own AI cost (own agent), and their secret key
never leaves their machine. A stateless Next.js page-service renders the public survey
page respondents fill out and writes submissions straight into the user's Supabase.

Full specs: [`docs/survey-mcp-build-brief.md`](docs/survey-mcp-build-brief.md),
[`docs/survey-mcp-saas-plan.md`](docs/survey-mcp-saas-plan.md),
[`docs/trust-model.md`](docs/trust-model.md), [`docs/spike-findings.md`](docs/spike-findings.md).

## Repos

- **`netmonty/agentic-survey-mcp`** (this repo) — the open-source product. Currently
  **private**; goes public at launch.
- **`netmonty/agentic-survey-site`** (private, at `~/agentic-survey-site`) — the
  hosted/ops side: deploy runbook, hosted-env template, future landing/billing.

## Layout (npm workspaces monorepo, Node ≥ 20)

```
packages/schema        SQL migration (migrations/0001_init.sql) + shared TS types + get_results contract
packages/core          pure service layer over an injected Supabase client; typed Result, never throws
packages/mcp-server    MCP server (stdio) + `agentic-survey` CLI; 12 tools over core
packages/page-service  Next.js 16 + React 19 public page (render + collect); self-hostable
docs/                  build brief, saas plan, trust model, spike findings
examples/              claude_desktop_config.json, sample config, sample-survey prompts
```

## Status — what's done

- ✅ **schema**: migration applied + verified; RLS proven (see spike findings).
- ✅ **core**: all functions + `get_results` aggregation; integration tests pass.
- ✅ **mcp-server**: 12 tools, CLI `init` (default cmd = serve the stdio server; `init` = setup), stdio smoke test passes.
- ✅ **page-service**: Next 16 + shadcn UI, all 7 question types + dropdown variant, two themes, themed number stepper; lib spike test passes.
- ✅ **packaging**: schema/core/mcp-server build to `dist` via `tsc -b` (project references); publishable; `bin` → `dist/cli.js`. (page-service is deployed, not npm-published.)
- ✅ **deployed**: page-service live at **https://agentic-survey-pages.vercel.app** — `/` = marketing landing, `/s/[ref]/[surveyId]` = survey, `/api/submit` = collect. Verified end-to-end with a real submission.

## Run it locally

```bash
npm install
npm run build         # tsc -b for schema/core/mcp-server (dist/)
npm test              # core + mcp-server + page-service lib (needs .env; see below)
npm run typecheck     # all packages, 0 errors expected
npm run dev --workspace @agentic-survey/page-service          # editorial theme
BRAND_THEME=charcoal npm run dev --workspace @agentic-survey/page-service
```

Tests run via **tsx + node:test** and read Supabase creds from the gitignored root
`.env` (loaded with `--env-file-if-exists`). They create + clean up their own data.

## The test Supabase project (THROWAWAY — rotate/delete)

- Project ref: **`hewkkeyjbbaetmimrawy`** (`https://hewkkeyjbbaetmimrawy.supabase.co`), Sydney, free tier.
- Keys live in the gitignored **`.env`** at the repo root (URL + `sb_publishable_…` + `sb_secret_…`).
- Demo survey "Published Survey" `id = 3106ccbc-121d-4d63-93c5-8791c14ce350` has all 7
  question types + a dropdown single_choice; plus a hidden draft survey.
- ⚠️ **These keys were shared in chat and are in `.env`. Rotate or delete this project before/at launch.** It's only for dev/demo.
- A Supabase MCP is connected in-session (used for the schema migration + RLS spike).

## Deploying the page-service (Vercel)

**Use prebuilt deploys.** Vercel's server-side build of this monorepo fails in its
lint/type step (undiagnosed; logs unavailable post-failure). Building locally and
uploading the output is reliable and what's in use:

```bash
cd ~/agentic-survey-mcp
npx vercel@latest build --prod
npx vercel@latest deploy --prebuilt --prod --yes
```

- Vercel project: **`agentic-survey-pages`** (team `montys-projects-af92f16b`,
  `prj_LQG0RtGELGjMSGMCP10NLYhMhklC`). CLI is already logged in on this machine
  (`.vercel/` in repo, gitignored).
- Project settings set via API: `rootDirectory = packages/page-service`,
  `framework = nextjs`, **deployment protection OFF** (the survey page must be public).
- Optional env (Vercel dashboard): `BRAND_THEME` (`editorial`|`charcoal`), `BRAND_NAME`,
  `BRAND_URL`, `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Full runbook: `~/agentic-survey-site/deploy/page-service.md`.

The landing page is `packages/page-service/public/landing.html` (static), served at `/`
via a `next.config` rewrite. Edit it there and redeploy.

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
- **Keys**: secret key is NEVER a tool argument — stored locally via `init`; tools read
  it from local config/env. Migration is run **out of band** (SQL editor / `supabase db
  push` / Supabase MCP) — the product holds no management token.
- **page-service is self-contained**: it mirrors the few schema types locally
  (`src/lib/types.ts`) instead of importing `@agentic-survey/schema`, so it builds
  standalone as a deployable app. Keep these in sync with packages/schema.
- **Themes**: two built-in, selected by `BRAND_THEME` env — `editorial` (warm paper +
  Fraunces/Hanken + clay) and `charcoal` (monochrome charcoal/white + Geist + compact).
- **Deploy**: prebuilt (above). **Next 16 + React 19** (cleared the Next DoS advisories).

## What's left for launch (all your-call / outward-facing)

1. **Publish to npm** — `@agentic-survey/schema`, `@agentic-survey/core`,
   `@agentic-survey/mcp-server` (packaging ready; `npm publish` per package, schema
   first). Then `npx @agentic-survey/mcp-server init` works for everyone.
2. **Make `agentic-survey-mcp` public** — the reputation event.
3. **LinkedIn URL** — `public/landing.html` footer has a placeholder
   `https://www.linkedin.com/in/YOUR-HANDLE`; swap it and redeploy.
4. **Rotate/delete the throwaway Supabase project** + the keys in `.env`.
5. Optional: custom domain on the page-service; Cloudflare Turnstile keys; env-gate the
   landing footer's personal links so self-hosters get a neutral page (deferred — would
   need server-rendering the landing or a build-time template).

## Gotchas

- `dist/` and `.next/` are gitignored; build with `npm run build` (publishable pkgs) /
  `next build` (page-service). Tests don't need a build (tsx resolves via tsconfig paths).
- Don't `cd` inside a single Bash compound command unless needed (permission prompts).
- Vercel build logs are empty once a build errors — only the dashboard shows them.
