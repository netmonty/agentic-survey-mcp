# Agentic Survey MCP

An open-source ([MIT](LICENSE)) [MCP](https://modelcontextprotocol.io) server that lets your own AI agent **build surveys and review results** — on **your own Supabase**, so you own all your data.

- **You own the data.** Surveys, questions, and responses live in *your* Supabase project. The author's infrastructure never stores anything.
- **You carry the AI cost.** Survey authoring and analysis happen inside *your* agent (Claude, etc.). There is no AI on the server side.
- **Bring your own keys.** Your Supabase secret key stays in local config on your machine — never transmitted, never logged.

> **Status: scaffolding.** This repo is being built per the specs in [`docs/`](docs/). See the [build brief](docs/survey-mcp-build-brief.md) and [project plan](docs/survey-mcp-saas-plan.md).

## Architecture

Three deliberately-separated pieces over one pure service layer:

```
  Your AI agent ──(MCP / stdio)──▶  mcp-server ──┐
                                                  ├──▶  core  ──▶  Your Supabase
  Respondent ──(browser)──▶  page-service ───────┘            (store of record)
```

1. **`packages/mcp-server`** — the product. Thin MCP tool handlers (stdio transport) over `core`. Talks to *your* Supabase with the keys you supplied.
2. **Your Supabase** — the store of record, owned entirely by you. The author never touches it.
3. **`packages/page-service`** — a stateless render + collect service for the public page respondents fill out. Forwards submissions straight into your Supabase; persists nothing.

Supporting packages:

- **`packages/core`** — pure TypeScript service layer (survey logic). No MCP, no HTTP, no framework types. Single source of truth.
- **`packages/schema`** — the SQL migration + shared TypeScript types (`Survey`, `Question`, `Response`, `GetResultsPayload`…).

## Quickstart

> Coming with the Phase 1 launch — see [`docs/survey-mcp-build-brief.md`](docs/survey-mcp-build-brief.md) §1.5.

```
install  →  init (or agent setup_connection)  →  build a survey via your agent
         →  publish  →  share link  →  agent reads results
```

## Development

This is an npm-workspaces monorepo (Node ≥ 20).

```bash
npm install
npm run build
npm test
```

## License

[MIT](LICENSE).
