# Contributing

Thanks for your interest in Agentic Survey MCP.

## Development setup

This is an npm-workspaces monorepo. You need **Node ≥ 20**.

```bash
npm install
npm run build
npm test
```

## Testing against Supabase

`core` and the migration are exercised against a **real, throwaway Supabase project** — never a shared or production one. Create a free project, grab its URL + `sb_secret_...` key, and point the test config at it. Never commit keys; use a local `.env` (gitignored).

## Project layout

- `packages/schema` — SQL migration + shared types.
- `packages/core` — pure service layer (no MCP, no HTTP).
- `packages/mcp-server` — MCP tools (stdio) + CLI `init`.
- `packages/page-service` — stateless render + collect.

Keep `core` free of MCP/HTTP/framework types — that discipline is what stops the two surfaces drifting. See [`docs/survey-mcp-build-brief.md`](docs/survey-mcp-build-brief.md).
