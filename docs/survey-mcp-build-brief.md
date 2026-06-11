# Open-Source Agentic Survey MCP — Phase 0 + Phase 1 Build Brief

*Concrete, executable build spec for the open-source launch. Target: a developer (or a coding agent) can work straight from this. Stack: TypeScript end-to-end, official MCP SDK (stdio transport), user-supplied Supabase, MIT.*

## Security model (decided)

**The user's own Supabase keys are used everywhere data is written.** There is no central store. Concretely:

- The MCP server holds the user's `sb_secret_...` key (server-side, elevated, bypasses RLS) in **local config on the user's machine** — never transmitted to the author's infrastructure, never logged.
- The public survey-page service writes into the user's Supabase using a **scoped credential the user controls**, passed/configured by the user — not a key you hold. (See "Page-service auth" below for the exact mechanism.)
- The author's hosted page-service instance is a **stateless relay**: it renders a form and forwards a submission to the user's Supabase using the user's credential. It persists nothing.

This means: no key the author holds can read or write user data; the author stores no responses; a key leak on the author's side exposes nothing because there are no keys and no data there.

---

## Repository layout

A single TypeScript monorepo (pnpm workspaces or npm workspaces).

```
/packages
  /core            # pure service layer — no MCP, no HTTP, no framework types
  /mcp-server      # thin MCP tool handlers over core; stdio transport; CLI `init`
  /page-service    # stateless render + collect; writes to user's Supabase
  /schema          # SQL migration + shared TypeScript types (Survey, Question, Response…)
/examples          # sample agent config, sample .env
README.md  LICENSE (MIT)  CONTRIBUTING.md  QUICKSTART.md
```

Why this split: `core` is the single source of truth for survey logic; `mcp-server` and `page-service` are both thin clients of it. Keeping `core` free of MCP/HTTP/framework types is the discipline that stops the two surfaces drifting.

---

## Phase 0: Foundation (~1–2 weeks)

### 0.1 Data model (`/packages/schema`)

Ship as a single idempotent SQL migration the `setup_connection` tool runs against the user's Supabase. Tables (all under a dedicated schema, e.g. `survey`):

- **surveys**: `id` (uuid pk), `title`, `description`, `status` (`draft` | `published` | `closed`), `created_at`, `updated_at`, `published_at`, `config` (`jsonb` — branding, settings).
- **questions**: `id` (uuid pk), `survey_id` (fk), `position` (int), `type` (text — `single_choice`|`multi_choice`|`short_text`|`long_text`|`rating`|`yes_no`|`number`), `prompt`, `required` (bool), `config` (`jsonb` — options, scale bounds, validation), `logic` (`jsonb` nullable — branching rules; optional for v1).
- **responses**: `id` (uuid pk), `survey_id` (fk), `submitted_at`, `respondent_meta` (`jsonb` — anonymous by default: maybe a coarse source tag, no PII unless the survey itself collects it).
- **answers**: `id` (uuid pk), `response_id` (fk), `question_id` (fk), `value` (`jsonb` — typed by question type).

Indexes: `questions(survey_id, position)`, `responses(survey_id, submitted_at)`, `answers(response_id)`.

**RLS**: enable on all tables. In the own-Supabase model the user is single-tenant in their own project, so RLS mainly guards the public surface: the page service should only be able to (a) read a *published* survey's definition and (b) insert responses/answers — never read other responses or any draft. Define policies accordingly (see Page-service auth).

Provide the migration both as raw SQL and as a programmatic runner the setup tool invokes.

### 0.2 Shared types (`/packages/schema`)

Export TypeScript types/interfaces for `Survey`, `Question`, `QuestionType`, `Response`, `Answer`, and the `GetResultsPayload` (below). These types are imported by `core`, `mcp-server`, and `page-service` so the whole system shares one definition.

### 0.3 Service layer (`/packages/core`)

Pure functions. Each takes an injected Supabase client (created from supplied credentials) — the layer never reads global config. Signatures (illustrative):

```ts
createSurvey(db, { title, description?, config? }) -> Survey
updateSurvey(db, id, patch) -> Survey
addQuestion(db, surveyId, { type, prompt, required?, config?, position? }) -> Question
updateQuestion(db, questionId, patch) -> Question
removeQuestion(db, questionId) -> void
reorderQuestions(db, surveyId, orderedIds) -> void
publishSurvey(db, id) -> { survey: Survey, shareUrl: string }   // sets status, stamps published_at
closeSurvey(db, id) -> Survey
listSurveys(db, { status? }) -> Survey[]
getSurvey(db, id) -> { survey, questions }
listResponses(db, surveyId, { limit?, cursor? }) -> { responses: Response[], nextCursor? }
getResults(db, surveyId) -> GetResultsPayload
```

Rules: every function returns typed results or a typed error object — never throws across the boundary. No `console.log` of credentials. All DB access goes through here (so the data layer stays swappable).

### 0.4 The `get_results` contract (design deliberately — it's what consumer agents depend on)

`GetResultsPayload` returns **both raw and aggregates** so the user's agent can either summarise or dig in:

```ts
{
  survey: { id, title, status, questionCount, responseCount },
  questions: [
    {
      id, type, prompt,
      aggregate: // shape depends on type:
        // choice types: { options: [{ label, count, pct }], totalAnswered }
        // rating/number: { mean, median, min, max, distribution: [{ bucket, count }], totalAnswered }
        // text types:    { totalAnswered, responses: [string]  }  // raw text for the agent to theme
    }
  ],
  responses: [   // raw, paginated if large
    { id, submittedAt, answers: [{ questionId, value }] }
  ],
  pagination?: { nextCursor }
}
```

Design notes: pre-compute cheap aggregates server-side (counts, means) so the agent doesn't burn tokens on arithmetic; hand text answers back raw so the agent does the theming/sentiment (that's *their* AI cost, by design); paginate `responses` so large surveys don't blow the context window — expose `nextCursor` and let the agent page.

### Phase 0 acceptance
- Migration runs cleanly into a fresh Supabase project and is idempotent (safe to re-run).
- `core` functions work against a real Supabase project using a `sb_secret_` key, with unit tests.
- `getResults` returns the documented shape for a survey with mixed question types and a handful of responses.

---

## Phase 1: Open-source MCP server — LAUNCH (~3–5 weeks)

### 1.1 MCP server (`/packages/mcp-server`)

- Official **TypeScript MCP SDK**, **stdio** transport. The agent launches the server as a subprocess.
- Config resolution order: explicit args → local config file (e.g. `~/.config/agentic-survey/config.json`) → env vars. Stores the user's Supabase URL + `sb_secret_` key and the page-service endpoint (defaulting to the author's hosted instance).
- Each tool handler: validate inputs (zod), build a Supabase client from stored creds, call the matching `core` function, return structured content + a short human-readable summary, and typed errors (`{ error: { code, message } }`) rather than throwing.

**Tools (Phase 1 surface):**

| Tool | Purpose | Notes |
|------|---------|-------|
| `setup_connection` | Store Supabase URL + secret key + page endpoint; run migration; verify | Writes local config; never transmits the key anywhere |
| `create_survey` | Create a draft survey | returns survey id |
| `add_question` | Add a question to a survey | type + prompt + config |
| `update_question` / `remove_question` / `reorder_questions` | Edit structure | |
| `publish_survey` | Publish + return share URL | share URL points at configured page endpoint |
| `get_share_link` | Return the public link for a published survey | |
| `list_surveys` | List with optional status filter | |
| `get_survey` | Full definition (survey + questions) | |
| `list_responses` | Paginated raw responses | cursor-based |
| `get_results` | Aggregates + raw, paginated | the analysis hand-off to the agent |

Tool descriptions must be semantically clear (the agent reads them to decide what to call) and include examples of when to chain them (`create_survey` → `add_question` ×N → `publish_survey` → `get_share_link`).

### 1.2 CLI `init` (`/packages/mcp-server`)

`npx agentic-survey init` — interactive terminal path for users who'd rather not drive setup through the agent. Prompts for Supabase URL + secret key (input hidden), offers to run the migration, writes the local config file, and prints the MCP server command + a ready-to-paste agent config snippet. This is the alternative to the agent calling `setup_connection`; both end at the same config.

### 1.3 Public survey-page service (`/packages/page-service`)

- Stateless. Two responsibilities: **render** a published survey's public page, and **collect** a submission.
- **Render**: given a survey id (from the share URL), read the *published* survey definition from the user's Supabase and render a clean, fast, mobile-first page. Server-rendered.
- **Collect**: accept a submission, validate against the survey's question config, write `response` + `answers` into the user's Supabase. Rate-limited + bot-protected (this is the only high-abuse surface). Persist nothing locally.
- **Self-hostable**: ships in the repo; the author runs a default hosted instance. The share URL / endpoint is configurable so DIY users point at their own deployment.

### 1.4 Page-service auth (the decided model: user's keys)

The page service must read a published survey and insert responses **into the user's Supabase**, using **the user's own credentials** — not a key the author holds. Mechanism:

- The page service is configured (per the user, in their deployment *or* — for the author's hosted default — via parameters the user controls) with the **publishable key** (`sb_publishable_...`) of the relevant Supabase project, which is the client-safe key that respects RLS.
- RLS policies (from Phase 0) make the publishable key sufficient and safe: it can `select` a survey definition only where `status = 'published'`, and `insert` into `responses`/`answers`, but cannot read existing responses or drafts. So even the client-safe key exposes nothing sensitive.
- For the author's hosted instance to serve *a given user's* survey, the published share link carries (or resolves to) that survey's project reference + publishable key — i.e. the user's own client-safe key travels with the public survey, exactly as it would if they self-served the page. The author's relay uses it to write back and holds nothing afterward.

Net: the author never holds a secret key, stores no data, and the worst-case leak (a publishable key in a share link) is by design client-safe and RLS-bounded. Document this model prominently — it's a trust selling point.

> Implementation note to verify during the spike: confirm the current Supabase publishable-key + RLS behaviour supports "insert responses, read only published surveys, nothing else" cleanly under the new key model (the `sb_publishable`/`sb_secret` scheme replacing `anon`/`service_role`, with legacy keys deprecated end of 2026). If RLS on the publishable key can't be scoped tightly enough for the hosted-relay case, fall back to: hosted relay forwards the raw submission to a lightweight write endpoint the *user* runs alongside their MCP server, which holds the secret key locally. Pick based on what the spike shows.

### 1.5 Repo polish (part of the launch, not an afterthought)
- **README**: what it is, the three-piece architecture diagram, the data-ownership guarantee, a 5-minute quickstart.
- **QUICKSTART**: install → `init` (or agent `setup_connection`) → create a survey via your agent → publish → share → read results. Must be genuinely 5 minutes.
- **LICENSE**: MIT. **CONTRIBUTING**: how to run the workspace, test against a throwaway Supabase project.
- **/examples**: sample agent config, sample `.env`, a sample survey.

### Phase 1 acceptance (the launch bar)
1. A new user, from scratch, can: install → connect their own Supabase via agent or CLI → have their agent build a multi-question survey → publish → open the public link in a browser → submit a response → have their agent call `get_results` and see it. End to end, no author-side data.
2. The public page is fast and mobile-correct; submit is rate-limited and bot-protected.
3. The user's secret key never leaves their machine; the page service holds no data; verified by inspection.
4. Repo is public, MIT, with a quickstart someone unaffiliated can follow unaided.

---

## Build order (recommended sequence)

1. **Schema + migration** (`/schema`) — write SQL + types; run into a throwaway Supabase project.
2. **`core` service layer** — implement + unit-test against that project; lock the `get_results` contract.
3. **MCP spike** — wire `create_survey` over stdio, test against Claude / MCP Inspector. Surface SDK/stdio quirks early.
4. **`setup_connection` + CLI `init`** — prove the bring-your-own-Supabase loop (key in local config, migration runs).
5. **Full tool surface** — the rest of the tools over `core`.
6. **Page-service spike** — render one survey + accept one submission writing to the user's Supabase; **here is where you validate the publishable-key + RLS auth model** (1.4) before building the full service.
7. **Page service complete** — all question types render + validate; rate limiting + bot protection.
8. **Repo polish + quickstart dry-run** with someone unaffiliated.

## What's explicitly NOT in this build
No web account/billing UI, no 3-survey cap, no Stripe, no remote/HTTP MCP transport, no OAuth, no multi-tenant hosted server, no in-app AI, no results web view. All of that is Phase 2+ and none of it is needed for the open-source launch or the reputation goal.

## Things to verify during the spikes (don't take from memory)
- Current Supabase **publishable/secret key** behaviour and RLS scoping under the new key model (legacy `anon`/`service_role` deprecating end of 2026).
- Current **MCP TypeScript SDK** stdio server API and tool-registration signatures (a new MCP spec is slated for ~July 28 2026 — build on current stable, isolate transport).
- That the **migration runner** works against both Supabase cloud and self-hosted Supabase.
