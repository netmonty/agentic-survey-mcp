# Spike findings — schema + RLS + setup (Phase 0)

Verified against a real Supabase project (`survey-mcp-spike`, Postgres 17, Sydney)
using the new key model. These close the brief's open items #2 (migration
execution) and #5 (publishable-key RLS scoping).

## #2 — Migration execution: no management token in the product

**Decision:** the tool never runs DDL. Schema setup is done out of band:
1. **Manual** — `init --print-sql`, paste into the Supabase SQL editor; or
2. **Supabase MCP / CLI** — `apply_migration` / `supabase db push`.

The automated "tool runs the migration with a Management API token" path is
**dropped entirely**. The product only ever handles the project keys
(`sb_secret_` locally, `sb_publishable_` in the share link).

**Verified:** the full migration applied cleanly via the Supabase MCP's
`apply_migration` into a fresh project. `setup_connection` / `init` will instead
just store creds and *verify the schema exists*, pointing the user to (1) or (2)
if it doesn't.

## #5 — Publishable-key (anon) RLS: scoping holds, with two corrections

Probed as the `anon` role (what `sb_publishable_` maps to). Final results:

| Check | Result |
|---|---|
| Read surveys → published only, draft hidden | ✅ |
| Read questions → published survey's only | ✅ |
| Read responses / answers | ✅ none |
| Submit (response + answer) to a published survey | ✅ accepted |
| Submit to a draft survey | ✅ blocked |
| Answer a draft survey's question | ✅ blocked |
| Update published survey / delete responses | ✅ 0 rows |

So the brief's page-service auth model stands: a `sb_publishable_` key in a public
share link is safe — it can render published surveys and collect submissions, and
nothing else. The fallback (a user-run write endpoint) is **not** needed.

### Correction 1 — the anon path must not use `RETURNING`

Postgres applies SELECT policies to a statement's `RETURNING` clause. Because
`responses`/`answers` have **no** anon SELECT policy (by design), any
`INSERT ... RETURNING` as anon fails with a row-level-security error — even when
the insert itself is valid.

**Consequence for the page-service:** generate response and answer `id`s
**client-side (UUIDs)** and insert **without `RETURNING`**. This also removes a
round-trip — one batched insert per submission.

### Correction 2 — answers insert validates via the question, not the response

The original answers policy verified the parent response joined to a published
survey. But that subquery reads `responses`, which anon can't SELECT, so it
always failed. Fixed: the policy validates that the answer's **`question_id`**
belongs to a published survey (anon *can* read published questions). The
`answers.response_id → responses.id` link is still enforced by the foreign key,
whose check bypasses RLS.

Both corrections are baked into `packages/schema/migrations/0001_init.sql`.
