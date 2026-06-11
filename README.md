# Agentic Survey MCP

An open-source ([MIT](LICENSE)) [MCP](https://modelcontextprotocol.io) server that lets your own AI agent **build surveys and review results** — on **your own Supabase**, so you own all your data.

- **You own the data.** Surveys, questions, and responses live in *your* Supabase project. The author's infrastructure stores nothing.
- **You carry the AI cost.** Survey authoring and analysis happen inside *your* agent (Claude, etc.). There is no AI on the server side.
- **Bring your own keys.** Your Supabase secret key stays in local config on your machine — never transmitted, never logged, never a tool argument. ([trust model](docs/trust-model.md))

## How it works

```
  Your AI agent ──(MCP / stdio)──▶  mcp-server ──┐
                                                  ├──▶  core ──▶  Your Supabase
  Respondent ──(browser)──▶  page-service ───────┘            (store of record)
```

1. Your agent calls the **MCP server** to create a survey, add questions, and publish it.
2. Publishing returns a **share link**. A respondent opens it; the **page-service** renders the form and writes their submission straight into *your* Supabase (it stores nothing itself).
3. Your agent calls `get_results` and analyses the responses.

## Packages

| Package | What it is |
|---|---|
| [`packages/schema`](packages/schema) | The SQL migration + shared TypeScript types (the data model + the `get_results` contract). |
| [`packages/core`](packages/core) | Pure service layer — all survey logic. No MCP, no HTTP, no framework types. |
| [`packages/mcp-server`](packages/mcp-server) | The MCP server (stdio) + the `agentic-survey` CLI. 12 tools over `core`. |
| [`packages/page-service`](packages/page-service) | Stateless Next.js + shadcn page that respondents fill out. Self-hostable. |

## Quickstart

See **[QUICKSTART.md](QUICKSTART.md)** — install → connect your Supabase → have your agent build a survey → publish → collect → read results.

```bash
# 1. Install the schema into your Supabase (SQL editor, or `supabase db push`)
npx -y @agentic-survey/mcp-server init --print-sql

# 2. Store your keys locally + verify (keys are typed into your terminal, never the agent)
npx -y @agentic-survey/mcp-server init

# 3. Add the printed snippet to your agent (e.g. Claude Desktop) and go:
#    "Build me a 5-question customer-satisfaction survey and publish it."
```

> Tip: `npm i -g @agentic-survey/mcp-server` gives you the shorter `agentic-survey init` command.

### Do I need to enable RLS in Supabase?

No, the schema SQL does it. Running `init --print-sql` enables Row Level Security and the
access policies on all four tables, so there's nothing to toggle in the Supabase dashboard
(and you shouldn't disable RLS). The `anon`/publishable key (which travels in the share link)
can then *only* read **published** surveys/questions and **insert** responses/answers; it
cannot read any responses or your drafts. The secret key on your machine bypasses RLS for
authoring and reading results. See [`docs/trust-model.md`](docs/trust-model.md).

## The MCP tools

`setup_connection`, `create_survey`, `add_question`, `update_question`, `remove_question`,
`reorder_questions`, `set_question_logic`, `validate_survey`, `publish_survey`, `get_share_link`,
`list_surveys`, `get_survey`, `list_responses`, `get_results`.

Question types: `single_choice`, `multi_choice`, `short_text`, `long_text`, `rating`, `yes_no`,
`number`, `date`, `time` (24-hour), `slider` (defaults to a 0–100 percentage).

## Self-hosting the page-service

The MCP server points share links at a default hosted instance, but the endpoint is configurable.
To run your own, deploy `packages/page-service` (a standard Next.js app) and set the page endpoint
in your config. See [`packages/page-service/.env.example`](packages/page-service/.env.example).

**Two built-in themes.** The respondent page ships with two visual themes, chosen deployment-wide
via the `BRAND_THEME` env var:

- `editorial` (default) — warm, paper-like, light.
- `charcoal` — dark and techy.

Set `BRAND_THEME=charcoal` (or leave it unset for `editorial`) on your deployment. Per-survey brand
colour and logo are separate and travel in each survey's own `config.theme`.

## Development

npm-workspaces monorepo, Node ≥ 20.

```bash
npm install
npm run typecheck          # all packages
npm test                   # core + mcp-server + page-service lib (needs a test Supabase; see CONTRIBUTING)
npm run dev --workspace @agentic-survey/page-service   # the public page locally
```

## License

[MIT](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) to hack on it.
