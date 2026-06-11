# Quickstart (~5 minutes)

From nothing to a published survey your agent built, with responses you can read back.

## You need

- A **Supabase project** (free tier is fine) — [supabase.com](https://supabase.com).
- An **MCP-capable agent** (e.g. Claude Desktop).
- **Node ≥ 20**.

## 1. Get your Supabase keys

In your project: **Settings → API Keys**. Copy:

- the **Project URL** (`https://<ref>.supabase.co`),
- the **secret key** (`sb_secret_…`),
- the **publishable key** (`sb_publishable_…`).

> Use the **new key model** (`sb_publishable_` / `sb_secret_`), not the legacy `anon`/`service_role` JWTs.

## 2. Install the schema

The tool doesn't run schema changes itself (your project API key can't run DDL). Pick one:

```bash
# Print the SQL and paste it into the Supabase SQL editor:
npx agentic-survey init --print-sql

# …or, if you use the Supabase CLI:
supabase db push
```

This creates four tables (`surveys`, `questions`, `responses`, `answers`) with row-level security.

## 3. Connect (keys stay on your machine)

```bash
npx agentic-survey init
```

It prompts for your URL + keys (the secret key is typed into a **hidden** prompt), writes them to
`~/.config/agentic-survey/config.json` (mode `0600`), verifies the schema, and prints an
agent-config snippet. **Your keys never go into the agent or to anyone else.**

## 4. Point your agent at it

Add the printed snippet to your agent. For Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentic-survey": { "command": "npx", "args": ["-y", "@agentic-survey/mcp-server"] }
  }
}
```

Restart the agent.

## 5. Build, publish, share, read

Talk to your agent:

> "Create a 4-question customer-satisfaction survey — a 1–5 rating, a yes/no, a multiple choice,
> and an open comment. Publish it and give me the share link."

It chains `create_survey → add_question ×4 → publish_survey → get_share_link`. Open the link,
submit a response, then:

> "Summarise the results so far."

It calls `get_results` and analyses the aggregates + raw text. Done — and every byte lived in your
own Supabase the whole time.
